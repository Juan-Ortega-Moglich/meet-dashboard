import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.primary !== undefined) updates.primary_color = body.primary;
  if (body.secondary !== undefined) updates.secondary_color = body.secondary;
  if (body.logoDataUrl !== undefined) updates.logo_data_url = body.logoDataUrl;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("plantillas")
    .update(updates)
    .eq("id", id)
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabase.from("plantillas").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
