import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBot, getBotTranscript } from "@/lib/recall";

// POST /api/recall/sync — Sync done bots that are missing from recordings table
export async function POST() {
  try {
    // Get all recall_bots with status "done"
    const { data: doneBots, error: botsError } = await supabase
      .from("recall_bots")
      .select("*")
      .eq("status", "done");

    if (botsError) {
      return NextResponse.json({ error: botsError.message }, { status: 500 });
    }

    if (!doneBots || doneBots.length === 0) {
      return NextResponse.json({ synced: 0, message: "No done bots found" });
    }

    // Get existing recordings to avoid duplicates
    const { data: existingRecs } = await supabase
      .from("recordings")
      .select("recall_bot_id");

    const existingBotIds = new Set((existingRecs || []).map((r) => r.recall_bot_id));

    let synced = 0;
    const errors: string[] = [];

    for (const botRecord of doneBots) {
      if (existingBotIds.has(botRecord.recall_bot_id)) continue;

      try {
        // Fetch bot data from Recall
        const recallBot = await getBot(botRecord.recall_bot_id) as {
          id: string;
          recordings: Array<{
            started_at: string;
            completed_at: string;
            status: { code: string };
            media_shortcuts: {
              video_mixed?: { data: { download_url: string } };
              transcript?: { data: { download_url: string } };
            };
          }>;
        };

        const recording = recallBot.recordings?.[0];
        if (!recording || recording.status.code !== "done") continue;

        // Calculate duration
        let duration = "";
        if (recording.started_at && recording.completed_at) {
          const start = new Date(recording.started_at).getTime();
          const end = new Date(recording.completed_at).getTime();
          const diffSec = Math.floor((end - start) / 1000);
          const hours = Math.floor(diffSec / 3600);
          const minutes = Math.floor((diffSec % 3600) / 60);
          const seconds = diffSec % 60;
          duration = hours > 0
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            : `${minutes}:${String(seconds).padStart(2, "0")}`;
        }

        const videoUrl = recording.media_shortcuts?.video_mixed?.data?.download_url || null;

        // Fetch transcript
        let transcript: Array<{ timestamp: string; speaker: string; text: string }> = [];
        try {
          transcript = await getBotTranscript(botRecord.recall_bot_id);
        } catch {
          // Transcript fetch failed, continue without it
        }

        // Detect platform
        const platform = botRecord.meeting_url?.includes("zoom") ? "Zoom" : "Google Meet";

        // Insert into recordings
        const { error: insertError } = await supabase.from("recordings").insert({
          recall_bot_id: botRecord.recall_bot_id,
          title: botRecord.meeting_title || "Reunión",
          host: botRecord.host,
          date: recording.started_at || new Date().toISOString(),
          duration,
          platform,
          video_url: videoUrl,
          transcript,
          status: "done",
        });

        if (insertError) {
          errors.push(`Bot ${botRecord.recall_bot_id}: ${insertError.message}`);
        } else {
          synced++;
        }
      } catch (err) {
        errors.push(`Bot ${botRecord.recall_bot_id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({ synced, total: doneBots.length, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
