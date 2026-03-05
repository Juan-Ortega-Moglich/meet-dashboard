import { NextRequest, NextResponse } from "next/server";
import { generateMinuta } from "@/lib/minuta";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { title, date, host, duration, transcript, recordingId } = await req.json();

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "No hay transcripción disponible para generar la minuta" },
        { status: 400 }
      );
    }

    const minuta = await generateMinuta({ title, date, host, duration, transcript });

    // Save to auto_minutas if recordingId is provided (manual generation from grabaciones)
    if (recordingId) {
      const { data: existing } = await supabase
        .from("auto_minutas")
        .select("id")
        .eq("recording_id", recordingId)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing
        await supabase
          .from("auto_minutas")
          .update({
            minuta_data: minuta,
            status: "ready",
            drive_link: null,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id);
      } else {
        // Insert new
        await supabase.from("auto_minutas").insert({
          recording_id: recordingId,
          recall_bot_id: recordingId,
          host,
          title,
          fecha: date,
          status: "ready",
          minuta_data: minuta,
        });
      }
    }

    return NextResponse.json({ minuta });
  } catch (error) {
    console.error("Error generating minuta:", error);
    return NextResponse.json(
      { error: "Error al generar la minuta" },
      { status: 500 }
    );
  }
}
