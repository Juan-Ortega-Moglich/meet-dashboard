import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, findDriveFolder, createDriveFolder, shareDriveFile } from "@/lib/google";
import { supabase } from "@/lib/supabase";

// Map host -> Drive client folder name inside "Minutas Moglich"
// (same structure used for minutas)
const HOST_FOLDER_MAP: Record<string, string> = {
  Operaciones: "Minutas sin formato",
  Andres: "Minutas sin formato",
  Pablo: "Minutas sin formato",
  Rafa: "Minutas sin formato",
  Inbest: "Obok",
  Wisdom: "Wisdom",
  Biofleming: "Biofleming",
};

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

    // 2. Download the video from the source URL
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: ${videoRes.status} ${videoRes.statusText}`);
    }

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // 3. Build a clean filename
    const sanitizedTitle = (title || "Grabacion")
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s\-_]/g, "")
      .trim();
    const dateStr = new Date().toISOString().split("T")[0];
    const ext = contentType.includes("webm") ? "webm" : "mp4";
    const fileName = `${sanitizedTitle} - ${host} - ${dateStr}.${ext}`;

    // 4. Upload to Drive using resumable upload (supports large files)
    // Step 4a: Initiate the resumable upload session
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
          "X-Upload-Content-Length": videoBuffer.byteLength.toString(),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const error = await initRes.text();
      throw new Error(`Failed to initiate upload: ${error}`);
    }

    const uploadUri = initRes.headers.get("location");
    if (!uploadUri) {
      throw new Error("No upload URI returned from Google Drive");
    }

    // Step 4b: Upload the actual video bytes
    const uploadRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": videoBuffer.byteLength.toString(),
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      throw new Error(`Failed to upload video: ${error}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;
    const webViewLink = uploadData.webViewLink;

    // 5. Make it shareable
    await shareDriveFile(accessToken, fileId);

    // 6. Optionally update the recording in Supabase with the Drive link
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
