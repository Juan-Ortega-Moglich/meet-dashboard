import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, findDriveFolder, createDriveFolder, uploadPdfToDrive, shareDriveFile } from "@/lib/google";
import { supabase } from "@/lib/supabase";

// Map host → Drive folder name inside "Minutas Moglich"
const HOST_FOLDER_MAP: Record<string, string> = {
  Operaciones: "Minutas sin formato",
  Andres: "Minutas sin formato",
  Pablo: "Minutas sin formato",
  Rafa: "Minutas sin formato",
  Inbest: "Obok",
  Wisdom: "Wisdom",
  Biofleming: "Biofleming",
};

// POST /api/minuta/upload — Upload PDF to Drive and save to meeting_minutes
export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, fileName, meetingTitle, cliente, fecha } = await req.json();

    if (!pdfBase64 || !fileName) {
      return NextResponse.json({ error: "pdfBase64 and fileName are required" }, { status: 400 });
    }

    // Get access token for Operaciones account
    const accessToken = await getAccessToken("Operaciones");

    // Find or create "Minutas Moglich" root folder
    let minutasRootId = await findDriveFolder(accessToken, "Minutas Moglich");
    if (!minutasRootId) {
      minutasRootId = await createDriveFolder(accessToken, "Minutas Moglich");
    }

    // Resolve the correct subfolder based on host
    const folderName = HOST_FOLDER_MAP[cliente] || "Minutas sin formato";
    let targetFolderId = await findDriveFolder(accessToken, folderName, minutasRootId);
    if (!targetFolderId) {
      targetFolderId = await createDriveFolder(accessToken, folderName, minutasRootId);
    }

    // Upload the PDF
    const { fileId, webViewLink } = await uploadPdfToDrive(
      accessToken,
      fileName,
      pdfBase64,
      targetFolderId
    );

    // Make it shareable
    await shareDriveFile(accessToken, fileId);

    // Insert into meeting_minutes table
    const { error: dbError } = await supabase.from("meeting_minutes").insert({
      nombre: meetingTitle || fileName,
      link: webViewLink,
      fecha: fecha || new Date().toISOString().split("T")[0],
      cliente: cliente || "Operaciones",
    });

    if (dbError) {
      console.error("[Minuta Upload] DB error:", dbError);
      return NextResponse.json({
        fileId,
        link: webViewLink,
        warning: "PDF subido a Drive pero falló al guardar en minutas: " + dbError.message,
      });
    }

    return NextResponse.json({
      fileId,
      link: webViewLink,
      message: "Minuta guardada en Drive y registrada en minutas",
    });
  } catch (error) {
    console.error("[Minuta Upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al subir la minuta" },
      { status: 500 }
    );
  }
}
