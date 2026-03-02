import { NextRequest, NextResponse } from "next/server";
import { removeBot } from "@/lib/recall";
import { supabase } from "@/lib/supabase";

// POST /api/recall/bot/leave — Remove a bot from a meeting
export async function POST(req: NextRequest) {
  try {
    const { recall_bot_id } = await req.json();

    if (!recall_bot_id) {
      return NextResponse.json({ error: "recall_bot_id is required" }, { status: 400 });
    }

    await removeBot(recall_bot_id);

    // Update status in Supabase
    await supabase
      .from("recall_bots")
      .update({ status: "done" })
      .eq("recall_bot_id", recall_bot_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Leave call error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove bot" },
      { status: 500 }
    );
  }
}
