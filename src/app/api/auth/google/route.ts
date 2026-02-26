import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

// GET /api/auth/google?host=Operaciones — Redirect to Google OAuth
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");

  if (!host) {
    return NextResponse.json({ error: "host is required" }, { status: 400 });
  }

  const authUrl = getAuthUrl(host);
  return NextResponse.redirect(authUrl);
}
