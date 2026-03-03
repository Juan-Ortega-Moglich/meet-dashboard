import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents, CalendarEvent } from "@/lib/google";
import { getIcsUrl, getIcsCalendarEvents } from "@/lib/ical";
import { createBot } from "@/lib/recall";
import { supabase } from "@/lib/supabase";

// All hosts with their calendar type
const HOSTS = [
  { name: "Operaciones", calendarType: "google" as const },
  { name: "Andres", calendarType: "google" as const },
  { name: "Pablo", calendarType: "google" as const },
  { name: "Rafa", calendarType: "google" as const },
  { name: "Wisdom", calendarType: "ics" as const },
  { name: "Biofleming", calendarType: "google" as const },
  { name: "Inbest", calendarType: "google" as const },
];

// How many minutes before the meeting to send the bot
const MINUTES_BEFORE = 1;
// Window in minutes to check (avoid sending bot to meetings that started long ago)
const WINDOW_MINUTES = 3;

async function getHostEvents(host: typeof HOSTS[0]): Promise<{ host: string; events: CalendarEvent[] }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
    const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

    let events: CalendarEvent[];

    if (host.calendarType === "ics" && getIcsUrl(host.name)) {
      events = await getIcsCalendarEvents(host.name, windowStart.toISOString(), windowEnd.toISOString());
    } else {
      events = await getCalendarEvents(host.name, windowStart.toISOString(), windowEnd.toISOString());
    }

    // Only events with a meet link
    return { host: host.name, events: events.filter((e) => e.meetLink) };
  } catch {
    return { host: host.name, events: [] };
  }
}

// GET /api/cron/auto-bot — Automatically send bots to meetings that are about to start
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let botsSent = 0;
  const details: string[] = [];

  // Get today's bots to avoid duplicates
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayBots } = await supabase
    .from("recall_bots")
    .select("meeting_url, meeting_title, host")
    .gte("created_at", todayStart.toISOString());

  const existingMeetings = new Set(
    (todayBots || []).map((b) => `${b.host}::${b.meeting_url}`)
  );

  // Check all hosts in parallel
  const results = await Promise.all(HOSTS.map(getHostEvents));

  for (const { host, events } of results) {
    for (const event of events) {
      if (!event.meetLink) continue;

      const eventStart = new Date(event.start);
      const diffMinutes = (eventStart.getTime() - now.getTime()) / (60 * 1000);

      // Send bot if meeting starts within -1 to +MINUTES_BEFORE minutes
      // (i.e., just started or about to start)
      if (diffMinutes > MINUTES_BEFORE || diffMinutes < -WINDOW_MINUTES) continue;

      // Check if bot was already sent for this meeting
      const key = `${host}::${event.meetLink}`;
      if (existingMeetings.has(key)) continue;

      // Send the bot
      try {
        const recallBot = await createBot({
          meeting_url: event.meetLink,
          bot_name: "Asistente Comercial",
        }) as { id: string };

        await supabase.from("recall_bots").insert({
          recall_bot_id: recallBot.id,
          meeting_url: event.meetLink,
          bot_name: "Asistente Comercial",
          host,
          status: "joining_call",
          meeting_title: event.summary || "Reunión",
        });

        existingMeetings.add(key);
        botsSent++;
        details.push(`${host}: ${event.summary}`);
        console.log(`[Auto-Bot] Sent bot to "${event.summary}" for ${host}`);
      } catch (err) {
        console.error(`[Auto-Bot] Failed to send bot for ${host}:`, err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    botsSent,
    details,
  });
}
