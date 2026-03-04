import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateMinuta } from "@/lib/minuta";

// PATCH /api/auto-minutas/[id] — Update minuta_data after editing, or retry generation
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Retry: re-generate the minuta from the linked recording's transcript
    if (body.retry) {
      // Get the auto_minuta record
      const { data: autoMinuta } = await supabase
        .from("auto_minutas")
        .select("recording_id, host, title, fecha")
        .eq("id", id)
        .single();

      if (!autoMinuta) {
        return NextResponse.json({ error: "Auto-minuta no encontrada" }, { status: 404 });
      }

      // Get the recording's transcript
      const { data: recording } = await supabase
        .from("recordings")
        .select("transcript, duration")
        .eq("id", autoMinuta.recording_id)
        .single();

      if (!recording || !recording.transcript || recording.transcript.length === 0) {
        return NextResponse.json({ error: "No hay transcripcion disponible" }, { status: 400 });
      }

      // Set status to generating
      await supabase
        .from("auto_minutas")
        .update({ status: "generating", error_message: null, updated_at: new Date().toISOString() })
        .eq("id", id);

      try {
        const minuta = await generateMinuta({
          title: autoMinuta.title,
          date: autoMinuta.fecha,
          host: autoMinuta.host,
          duration: recording.duration || "",
          transcript: recording.transcript,
        });

        await supabase
          .from("auto_minutas")
          .update({
            minuta_data: minuta,
            status: "ready",
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        return NextResponse.json({ success: true, minuta });
      } catch (genErr) {
        await supabase
          .from("auto_minutas")
          .update({
            status: "error",
            error_message: genErr instanceof Error ? genErr.message : "Error al regenerar",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        return NextResponse.json({ error: "Error al regenerar la minuta" }, { status: 500 });
      }
    }

    // Normal update: save edited minuta_data
    const { error } = await supabase
      .from("auto_minutas")
      .update({
        minuta_data: body.minuta_data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}
