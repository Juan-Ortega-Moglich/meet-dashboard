import { NextRequest, NextResponse } from "next/server";
import { createBot, getBot } from "@/lib/recall";
import { supabase } from "@/lib/supabase";

// POST /api/recall/bot — Create a bot and send it to a meeting
export async function POST(req: NextRequest) {
  try {
    const { meeting_url, host, meeting_title } = await req.json();

    if (!meeting_url) {
      return NextResponse.json({ error: "meeting_url is required" }, { status: 400 });
    }

    // Send bot to Recall.ai
    const recallBot = await createBot({
      meeting_url,
      bot_name: "Möglich Bot",
    }) as { id: string };

    // Save to Supabase
    const { data, error } = await supabase.from("recall_bots").insert({
      recall_bot_id: recallBot.id,
      meeting_url,
      bot_name: "Möglich Bot",
      host: host || "Operaciones",
      status: "joining_call",
      meeting_title: meeting_title || "Reunión",
    }).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save bot" }, { status: 500 });
    }

    return NextResponse.json({ bot: data, recall_bot_id: recallBot.id });
  } catch (err) {
    console.error("Create bot error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create bot" },
      { status: 500 }
    );
  }
}

// GET /api/recall/bot — List all bots for a host, refreshing active statuses from Recall
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");

  let query = supabase
    .from("recall_bots")
    .select("*")
    .order("created_at", { ascending: false });

  if (host) {
    query = query.eq("host", host);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For active bots, refresh status directly from Recall.ai
  const activeStatuses = ["joining_call", "in_waiting_room", "in_call_not_recording", "in_call_recording"];
  const bots = await Promise.all(
    (data || []).map(async (bot) => {
      if (bot.recall_bot_id && activeStatuses.includes(bot.status)) {
        try {
          const recallBot = await getBot(bot.recall_bot_id) as {
            status_changes: Array<{ code: string }>;
          };
          const latest = recallBot.status_changes?.[recallBot.status_changes.length - 1];
          if (latest && latest.code !== bot.status) {
            // Update in Supabase for future queries
            await supabase
              .from("recall_bots")
              .update({ status: latest.code })
              .eq("recall_bot_id", bot.recall_bot_id);
            return { ...bot, status: latest.code };
          }
        } catch {
          // If Recall API fails, return existing status
        }
      }
      return bot;
    })
  );

  return NextResponse.json({ bots });
}
