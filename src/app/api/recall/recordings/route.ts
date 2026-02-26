import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBot } from "@/lib/recall";

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

  // For each recording, refresh video URL if needed (presigned URLs expire after 5h)
  const recordings = await Promise.all(
    (data || []).map(async (rec) => {
      // If video URL exists, try to refresh it from Recall
      if (rec.recall_bot_id && rec.video_url) {
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
            return { ...rec, video_url: freshUrl };
          }
        } catch {
          // If Recall API fails, return the existing URL
        }
      }
      return rec;
    })
  );

  return NextResponse.json({ recordings });
}
