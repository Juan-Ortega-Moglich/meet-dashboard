import { NextRequest, NextResponse } from "next/server";
import { getBot, getBotTranscript } from "@/lib/recall";
import { supabase } from "@/lib/supabase";

// POST /api/recall/webhook — Receive events from Recall.ai
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { event, data } = payload;

    console.log(`[Recall Webhook] ${event}`, JSON.stringify(data, null, 2));

    const botId = data?.bot?.id;
    if (!botId) {
      return NextResponse.json({ received: true });
    }

    // Update bot status for any bot.* event
    if (event.startsWith("bot.")) {
      const statusCode = data?.data?.code;
      if (statusCode) {
        await supabase
          .from("recall_bots")
          .update({ status: statusCode })
          .eq("recall_bot_id", botId);
      }
    }

    // When bot is done, fetch recordings and save them
    if (event === "bot.done") {
      await handleBotDone(botId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Recall Webhook] Error:", err);
    return NextResponse.json({ received: true });
  }
}

async function handleBotDone(botId: string) {
  try {
    // Fetch full bot data from Recall
    const recallBot = await getBot(botId) as {
      id: string;
      bot_name: string;
      meeting_url: string;
      recordings: Array<{
        id: string;
        started_at: string;
        completed_at: string;
        status: { code: string };
        media_shortcuts: {
          video_mixed?: { status: { code: string }; data: { download_url: string } };
          transcript?: { status: { code: string }; data: { download_url: string } };
        };
      }>;
    };

    // Get our bot record from Supabase
    const { data: botRecord } = await supabase
      .from("recall_bots")
      .select("*")
      .eq("recall_bot_id", botId)
      .single();

    if (!botRecord) {
      console.error(`[Webhook] No bot record found for ${botId}`);
      return;
    }

    const recording = recallBot.recordings?.[0];
    if (!recording) {
      console.log(`[Webhook] No recordings for bot ${botId}`);
      return;
    }

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

    // Get video URL
    const videoUrl = recording.media_shortcuts?.video_mixed?.data?.download_url || null;

    // Fetch transcript using the shared helper
    let transcript: Array<{ timestamp: string; speaker: string; text: string }> = [];
    try {
      transcript = await getBotTranscript(botId);
    } catch (err) {
      console.error("[Webhook] Failed to fetch transcript:", err);
    }

    // Detect platform from meeting URL
    const platform = botRecord.meeting_url?.includes("zoom") ? "Zoom" : "Google Meet";

    // Save recording to Supabase
    const { error } = await supabase.from("recordings").insert({
      recall_bot_id: botId,
      title: botRecord.meeting_title || "Reunión",
      host: botRecord.host,
      date: recording.started_at || new Date().toISOString(),
      duration,
      platform,
      video_url: videoUrl,
      transcript,
      status: "done",
    });

    if (error) {
      console.error("[Webhook] Failed to save recording:", error);
    } else {
      console.log(`[Webhook] Recording saved for bot ${botId}`);
    }

    // Update bot status
    await supabase
      .from("recall_bots")
      .update({ status: "done" })
      .eq("recall_bot_id", botId);
  } catch (err) {
    console.error("[Webhook] handleBotDone error:", err);
  }
}
