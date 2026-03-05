import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("plantillas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const plantillas = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    primary: row.primary_color,
    secondary: row.secondary_color,
    logoDataUrl: row.logo_data_url,
    createdAt: new Date(row.created_at).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  }));

  return NextResponse.json({ plantillas });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, primary, secondary, logoDataUrl } = body;

  if (!name || !primary || !secondary) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("plantillas")
    .insert({
      name,
      primary_color: primary,
      secondary_color: secondary,
      logo_data_url: logoDataUrl || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    plantilla: {
      id: data.id,
      name: data.name,
      primary: data.primary_color,
      secondary: data.secondary_color,
      logoDataUrl: data.logo_data_url,
      createdAt: new Date(data.created_at).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    },
  });
}
