import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/recall";
import { supabase } from "@/lib/supabase";

// GET /api/recall/bot/[id] — Get bot status from Recall + update in Supabase
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch fresh status from Recall.ai
    const recallBot = await getBot(id) as {
      id: string;
      status_changes: Array<{ code: string; sub_code: string | null; updated_at: string }>;
      recordings: Array<{
        id: string;
        status: { code: string };
        media_shortcuts: {
          video_mixed?: { data: { download_url: string } };
          transcript?: { data: { download_url: string } };
        };
      }>;
    };

    // Get latest status
    const latestStatus = recallBot.status_changes?.[recallBot.status_changes.length - 1];

    // Update status in Supabase
    if (latestStatus) {
      await supabase
        .from("recall_bots")
        .update({ status: latestStatus.code })
        .eq("recall_bot_id", id);
    }

    return NextResponse.json({ bot: recallBot, status: latestStatus?.code });
  } catch (err) {
    console.error("Get bot error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get bot" },
      { status: 500 }
    );
  }
}
