import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, findDriveFolder, createDriveFolder, uploadPdfToDrive, shareDriveFile } from "@/lib/google";
import { supabase } from "@/lib/supabase";

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

    // Find or create client subfolder inside Minutas
    let targetFolderId = minutasRootId;
    if (cliente) {
      let clientFolderId = await findDriveFolder(accessToken, cliente, minutasRootId);
      if (!clientFolderId) {
        clientFolderId = await createDriveFolder(accessToken, cliente, minutasRootId);
      }
      targetFolderId = clientFolderId;
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
