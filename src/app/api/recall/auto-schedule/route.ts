import { NextResponse } from "next/server";
import { getCalendarEvents, CalendarEvent } from "@/lib/google";
import { getIcsUrl, getIcsCalendarEvents } from "@/lib/ical";
import { createBot } from "@/lib/recall";
import { supabase } from "@/lib/supabase";

const HOSTS = [
  { name: "Operaciones", calendarType: "google" as const },
  { name: "Andres", calendarType: "google" as const },
  { name: "Pablo", calendarType: "google" as const },
  { name: "Rafa", calendarType: "google" as const },
  { name: "Wisdom", calendarType: "ics" as const },
  { name: "Biofleming", calendarType: "google" as const },
  { name: "Inbest", calendarType: "google" as const },
];

async function getHostEvents(host: typeof HOSTS[0]): Promise<{ host: string; events: CalendarEvent[] }> {
  try {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    let events: CalendarEvent[];

    if (host.calendarType === "ics" && getIcsUrl(host.name)) {
      events = await getIcsCalendarEvents(host.name, now.toISOString(), endOfDay.toISOString());
    } else {
      events = await getCalendarEvents(host.name, now.toISOString(), endOfDay.toISOString());
    }

    // Only events with a meet link that haven't ended yet
    return {
      host: host.name,
      events: events.filter((e) => e.meetLink && new Date(e.end) > now),
    };
  } catch {
    return { host: host.name, events: [] };
  }
}

// POST /api/recall/auto-schedule — Schedule bots for all today's meetings with join_at
export async function POST() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Get today's bots to avoid duplicates
  const { data: todayBots } = await supabase
    .from("recall_bots")
    .select("meeting_url, host")
    .gte("created_at", todayStart.toISOString());

  const existingMeetings = new Set(
    (todayBots || []).map((b) => `${b.host}::${b.meeting_url}`)
  );

  // Fetch all hosts' events in parallel
  const results = await Promise.all(HOSTS.map(getHostEvents));

  let scheduled = 0;
  const details: string[] = [];

  for (const { host, events } of results) {
    for (const event of events) {
      if (!event.meetLink) continue;

      const key = `${host}::${event.meetLink}`;
      if (existingMeetings.has(key)) continue;

      try {
        const recallBot = await createBot({
          meeting_url: event.meetLink,
          bot_name: "Asistente Comercial",
          join_at: event.start, // Recall will join at this exact time
        }) as { id: string };

        await supabase.from("recall_bots").insert({
          recall_bot_id: recallBot.id,
          meeting_url: event.meetLink,
          bot_name: "Asistente Comercial",
          host,
          status: "ready",
          meeting_title: event.summary || "Reunión",
        });

        existingMeetings.add(key);
        scheduled++;
        details.push(`${host}: ${event.summary} (${event.start})`);
        console.log(`[Auto-Schedule] Scheduled bot for "${event.summary}" (${host}) at ${event.start}`);
      } catch (err) {
        console.error(`[Auto-Schedule] Failed for ${host}:`, err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scheduled,
    details,
    timestamp: now.toISOString(),
  });
}
