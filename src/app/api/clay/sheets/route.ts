import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accessToken = await getAccessToken("Operaciones");

    const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and modifiedTime > '2026-03-01T00:00:00Z' and modifiedTime < '2026-04-15T00:00:00Z' and 'me' in owners`;
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
