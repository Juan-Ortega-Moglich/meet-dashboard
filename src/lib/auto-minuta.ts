import { supabase } from "@/lib/supabase";
import { generateMinuta, TranscriptBlock } from "@/lib/minuta";

export interface TriggerAutoMinutaParams {
  recordingId: string;
  recallBotId: string;
  host: string;
  title: string;
  date: string;
  duration: string;
  transcript: TranscriptBlock[];
}

// Solo generar minutas automaticas para estos hosts
const AUTO_MINUTA_HOSTS = ["Wisdom", "Biofleming", "Inbest"];

export async function triggerAutoMinuta(params: TriggerAutoMinutaParams) {
  const { recordingId, recallBotId, host, title, date, duration, transcript } = params;

  // Skip hosts that don't have auto-minuta enabled
  if (!AUTO_MINUTA_HOSTS.includes(host)) {
    console.log(`[AutoMinuta] Host "${host}" not in auto-minuta list, skipping`);
    return;
  }

  // Idempotency: skip if auto_minuta already exists for this recording
  const { data: existing } = await supabase
    .from("auto_minutas")
    .select("id")
    .eq("recording_id", recordingId)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[AutoMinuta] Already exists for recording ${recordingId}, skipping`);
    return;
  }

  // Skip if no transcript
  if (!transcript || transcript.length === 0) {
    console.log(`[AutoMinuta] No transcript for recording ${recordingId}, skipping`);
    return;
  }

  // Insert with status "generating"
  const { data: inserted, error: insertError } = await supabase
    .from("auto_minutas")
    .insert({
      recording_id: recordingId,
      recall_bot_id: recallBotId,
      host,
      title,
      fecha: date,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[AutoMinuta] Failed to insert:", insertError);
    return;
  }

  const autoMinutaId = inserted.id;

  try {
    const minuta = await generateMinuta({ title, date, host, duration, transcript });

    await supabase
      .from("auto_minutas")
      .update({
        minuta_data: minuta,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", autoMinutaId);

    console.log(`[AutoMinuta] Generated successfully for recording ${recordingId}`);
  } catch (err) {
    console.error("[AutoMinuta] Generation failed:", err);
    await supabase
      .from("auto_minutas")
      .update({
        status: "error",
        error_message: err instanceof Error ? err.message : "Error desconocido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", autoMinutaId);
  }
}
