import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accessToken = await getAccessToken("Operaciones");

    const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'clay' or name contains 'Clay' or name contains 'numero' or name contains 'Numero')`;
    const params = new URLSearchParams({
      q,
      pageSize: "100",
      fields:
        "files(id,name,createdTime,modifiedTime,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),webViewLink)",
      orderBy: "modifiedTime desc",
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
