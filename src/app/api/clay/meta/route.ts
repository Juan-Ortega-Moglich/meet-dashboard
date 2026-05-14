import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google";

export const dynamic = "force-dynamic";

const SHEET_ID = process.env.CLAY_SHEET_ID || "1GgdBrwod_zmMV5qlXPIAYxYAVXXUFmvFF8IdrRBpfgY";

export async function GET() {
  try {
    const accessToken = await getAccessToken("Operaciones");

    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${SHEET_ID}?fields=id,name,owners,lastModifyingUser,modifiedTime,createdTime,sharingUser,webViewLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();

    const revRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${SHEET_ID}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser)&pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const revisions = await revRes.json();

    return NextResponse.json({ meta, revisions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
