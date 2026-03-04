import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/auto-minutas — List auto-generated minutas
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");
  const status = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("auto_minutas")
    .select("*")
    .order("created_at", { ascending: false });

  if (host && host !== "Todos") {
    query = query.eq("host", host);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ minutas: data || [] });
}
