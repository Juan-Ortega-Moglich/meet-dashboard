import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBot, getBotTranscript } from "@/lib/recall";

// GET /api/recall/recordings — List recordings, optionally filtered by host
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");

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
              // Save to Supabase for future requests
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

  return NextResponse.json({ recordings });
}
