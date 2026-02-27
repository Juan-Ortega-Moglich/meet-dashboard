import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBot, getBotTranscript } from "@/lib/recall";

// Auto-sync: create recording entries for done bots that are missing from recordings table
async function autoSync() {
  const { data: doneBots } = await supabase
    .from("recall_bots")
    .select("*")
    .eq("status", "done");

  if (!doneBots || doneBots.length === 0) return;

  const { data: existingRecs } = await supabase
    .from("recordings")
    .select("recall_bot_id");

  const existingBotIds = new Set((existingRecs || []).map((r) => r.recall_bot_id));
  const missing = doneBots.filter((b) => !existingBotIds.has(b.recall_bot_id));

  if (missing.length === 0) return;

  for (const botRecord of missing) {
    try {
      const recallBot = await getBot(botRecord.recall_bot_id) as {
        recordings: Array<{
          started_at: string;
          completed_at: string;
          status: { code: string };
          media_shortcuts: {
            video_mixed?: { data: { download_url: string } };
          };
        }>;
      };

      const recording = recallBot.recordings?.[0];
      if (!recording || recording.status.code !== "done") continue;

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

      let transcript: Array<{ timestamp: string; speaker: string; text: string }> = [];
      try {
        transcript = await getBotTranscript(botRecord.recall_bot_id);
      } catch {
        // continue without transcript
      }

      const platform = botRecord.meeting_url?.includes("zoom") ? "Zoom" : "Google Meet";

      await supabase.from("recordings").insert({
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
    } catch {
      // Skip this bot on error
    }
  }
}

// GET /api/recall/recordings — List recordings, optionally filtered by host
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");

  // Auto-sync any done bots missing from recordings
  await autoSync();

  let query = supabase
    .from("recordings")
    .select("*")
    .eq("status", "done")
    .order("date", { ascending: false });

  if (host && host !== "Todos") {
    query = query.eq("host", host);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const recordings = await Promise.all(
    (data || []).map(async (rec) => {
      let videoUrl = rec.video_url;
      let transcript = rec.transcript;

      if (rec.recall_bot_id) {
        try {
          const bot = await getBot(rec.recall_bot_id) as {
            recordings: Array<{
              media_shortcuts: {
                video_mixed?: { data: { download_url: string } };
              };
            }>;
          };

          // Refresh video URL (presigned URLs expire after 5h)
          const freshUrl = bot.recordings?.[0]?.media_shortcuts?.video_mixed?.data?.download_url;
          if (freshUrl) {
            videoUrl = freshUrl;
          }

          // If no transcript saved, fetch directly from Recall
          if (!transcript || (Array.isArray(transcript) && transcript.length === 0)) {
            const fetched = await getBotTranscript(rec.recall_bot_id);
            if (fetched.length > 0) {
              transcript = fetched;
              await supabase
                .from("recordings")
                .update({ transcript: fetched })
                .eq("id", rec.id);
            }
          }
        } catch {
          // If Recall API fails, return existing data
        }
      }

      return { ...rec, video_url: videoUrl, transcript: transcript || [] };
    })
  );

  // Extract unique hosts from all recordings for the sidebar
  const { data: allRecs } = await supabase
    .from("recordings")
    .select("host")
    .eq("status", "done");

  const hosts = [...new Set((allRecs || []).map((r) => r.host).filter(Boolean))].sort();

  return NextResponse.json({ recordings, hosts });
}
