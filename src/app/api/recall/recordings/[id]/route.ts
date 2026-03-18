import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBot, getBotTranscript } from "@/lib/recall";

// GET /api/recall/recordings/[id] — Get a single recording with fresh video URL and transcript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: rec, error } = await supabase
      .from("recordings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !rec) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    let videoUrl = rec.video_url;
    let transcript = rec.transcript;

    // Refresh video URL and transcript from Recall if available
    if (rec.recall_bot_id) {
      try {
        const bot = await getBot(rec.recall_bot_id) as {
          recordings: Array<{
            media_shortcuts: {
              video_mixed?: { data: { download_url: string } };
            };
          }>;
        };

        const freshUrl = bot.recordings?.[0]?.media_shortcuts?.video_mixed?.data?.download_url;
        if (freshUrl) {
          videoUrl = freshUrl;
        }

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

    return NextResponse.json({
      recording: { ...rec, video_url: videoUrl, transcript: transcript || [] },
    });
  } catch (err) {
    console.error("[RecordingDetail] Error:", err);
    return NextResponse.json(
      { error: "Error al obtener la grabación" },
      { status: 500 }
    );
  }
}
