import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, findDriveFolder, createDriveFolder, shareDriveFile } from "@/lib/google";
import { supabase } from "@/lib/supabase";

// Map host -> Drive client folder name inside "Minutas Moglich"
const HOST_FOLDER_MAP: Record<string, string> = {
  Operaciones: "Minutas sin formato",
  Andres: "Minutas sin formato",
  Pablo: "Minutas sin formato",
  Rafa: "Minutas sin formato",
  Inbest: "Obok",
  Wisdom: "Wisdom",
  Biofleming: "Biofleming",
};

// Upload in 5MB chunks to avoid memory issues
const CHUNK_SIZE = 5 * 1024 * 1024;

// POST /api/recordings/save-to-drive — Download video from URL and upload to Drive
export async function POST(req: NextRequest) {
  try {
    const { videoUrl, title, host, recordingId } = await req.json();

    if (!videoUrl || !host) {
      return NextResponse.json(
        { error: "videoUrl and host are required" },
        { status: 400 }
      );
    }

    // Get access token (using Operaciones account for Drive access)
    const accessToken = await getAccessToken("Operaciones");

    // 1. Navigate to the folder: "Minutas Moglich" > [client folder] > "Grabaciones"
    let rootId = await findDriveFolder(accessToken, "Minutas Moglich");
    if (!rootId) {
      rootId = await createDriveFolder(accessToken, "Minutas Moglich");
    }

    const clientFolderName = HOST_FOLDER_MAP[host] || host;
    let clientFolderId = await findDriveFolder(accessToken, clientFolderName, rootId);
    if (!clientFolderId) {
      clientFolderId = await createDriveFolder(accessToken, clientFolderName, rootId);
    }

    let grabacionesFolderId = await findDriveFolder(accessToken, "Grabaciones", clientFolderId);
    if (!grabacionesFolderId) {
      grabacionesFolderId = await createDriveFolder(accessToken, "Grabaciones", clientFolderId);
    }

    // 2. Get video size and content type via HEAD request first
    const headRes = await fetch(videoUrl, { method: "HEAD" });
    if (!headRes.ok) {
      // URL may have expired (Recall.ai S3 URLs are temporary)
      throw new Error(`No se pudo acceder al video (${headRes.status}). Es posible que el enlace haya expirado.`);
    }

    const contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);
    const contentType = headRes.headers.get("content-type") || "video/mp4";

    if (contentLength === 0) {
      throw new Error("El video tiene tamaño 0 o no se pudo determinar su tamaño.");
    }

    // 3. Build a clean filename
    const sanitizedTitle = (title || "Grabacion")
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s\-_]/g, "")
      .trim();
    const dateStr = new Date().toISOString().split("T")[0];
    const ext = contentType.includes("webm") ? "webm" : "mp4";
    const fileName = `${sanitizedTitle} - ${host} - ${dateStr}.${ext}`;

    // 4. Initiate resumable upload session on Google Drive
    const metadata = {
      name: fileName,
      mimeType: contentType,
      parents: [grabacionesFolderId],
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": contentLength.toString(),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const error = await initRes.text();
      throw new Error(`Error al iniciar subida a Drive: ${error}`);
    }

    const uploadUri = initRes.headers.get("location");
    if (!uploadUri) {
      throw new Error("Google Drive no devolvió un URI de subida");
    }

    // 5. Stream download → chunked upload to Drive
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok || !videoRes.body) {
      throw new Error(`Error al descargar el video: ${videoRes.status}`);
    }

    const reader = videoRes.body.getReader();
    let uploadedBytes = 0;
    let buffer = new Uint8Array(0);
    let uploadData: { id: string; webViewLink: string } | null = null;

    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
      }

      // Upload when we have a full chunk or it's the last piece
      while (buffer.length >= CHUNK_SIZE || (done && buffer.length > 0)) {
        const chunkSize = Math.min(CHUNK_SIZE, buffer.length);
        const chunk = buffer.slice(0, chunkSize);
        buffer = buffer.slice(chunkSize);

        const rangeEnd = uploadedBytes + chunkSize - 1;
        const isLastChunk = done && buffer.length === 0;

        const chunkRes = await fetch(uploadUri, {
          method: "PUT",
          headers: {
            "Content-Length": chunkSize.toString(),
            "Content-Range": `bytes ${uploadedBytes}-${rangeEnd}/${contentLength}`,
          },
          body: chunk,
        });

        // Google returns 308 for intermediate chunks, 200 for the last one
        if (isLastChunk) {
          if (!chunkRes.ok) {
            const error = await chunkRes.text();
            throw new Error(`Error al subir chunk final: ${error}`);
          }
          uploadData = await chunkRes.json();
        } else if (chunkRes.status !== 308 && !chunkRes.ok) {
          const error = await chunkRes.text();
          throw new Error(`Error al subir chunk: ${error}`);
        }

        uploadedBytes += chunkSize;
      }

      if (done) break;
    }

    if (!uploadData) {
      throw new Error("No se recibió respuesta de Google Drive al finalizar la subida");
    }

    const fileId = uploadData.id;
    const webViewLink = uploadData.webViewLink;

    // 6. Make it shareable
    await shareDriveFile(accessToken, fileId);

    // 7. Update the recording in Supabase with the Drive link
    if (recordingId) {
      await supabase
        .from("recordings")
        .update({ drive_video_link: webViewLink })
        .eq("id", recordingId);
    }

    return NextResponse.json({
      fileId,
      link: webViewLink,
      fileName,
      message: "Video guardado en Drive",
    });
  } catch (error) {
    console.error("[SaveVideoToDrive] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al subir el video" },
      { status: 500 }
    );
  }
}
