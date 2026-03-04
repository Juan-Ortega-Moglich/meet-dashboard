import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, findDriveFolder, createDriveFolder, uploadPdfToDrive, shareDriveFile } from "@/lib/google";
import { supabase } from "@/lib/supabase";

// Map host -> Drive folder name inside "Minutas Moglich"
const HOST_FOLDER_MAP: Record<string, string> = {
  Operaciones: "Minutas sin formato",
  Andres: "Minutas sin formato",
  Pablo: "Minutas sin formato",
  Rafa: "Minutas sin formato",
  Inbest: "Obok",
  Wisdom: "Wisdom",
  Biofleming: "Biofleming",
};

// POST /api/auto-minutas/[id]/save-to-drive — Upload PDF to Drive and mark as saved
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      console.error("[AutoMinuta SaveToDrive] DB error:", dbError);
    }

    // Update auto_minutas status to "saved" with drive_link
    await supabase
      .from("auto_minutas")
      .update({
        status: "saved",
        drive_link: webViewLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      fileId,
      link: webViewLink,
      message: "Minuta guardada en Drive y registrada",
    });
  } catch (error) {
    console.error("[AutoMinuta SaveToDrive] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al subir la minuta" },
      { status: 500 }
    );
  }
}
