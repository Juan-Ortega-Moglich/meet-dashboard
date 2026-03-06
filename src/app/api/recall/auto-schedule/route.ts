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

// Host priority: higher index = higher priority. When multiple hosts share the
// same meeting link, only the highest-priority host gets a bot.
const HOST_PRIORITY: Record<string, number> = {
  Operaciones: 0,
  Andres: 1,
  Pablo: 2,
  Rafa: 3,
  Wisdom: 4,
  Biofleming: 5,
  Inbest: 6,
};

interface MeetingCandidate {
  host: string;
  event: CalendarEvent;
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

  // Track which meeting URLs already have a bot (regardless of host)
  const existingMeetingUrls = new Set(
    (todayBots || []).map((b) => b.meeting_url)
  );

  // Fetch all hosts' events in parallel
  const results = await Promise.all(HOSTS.map(getHostEvents));

  // Group all events by meetLink, keeping the highest-priority host per link
  // Skip weekly recurring meetings (they don't get automatic bots)
  const meetingMap = new Map<string, MeetingCandidate>();
  const skippedWeekly: string[] = [];

  for (const { host, events } of results) {
    for (const event of events) {
      if (!event.meetLink) continue;

      if (event.isWeeklyRecurring) {
        skippedWeekly.push(`${host}: "${event.summary}" (semanal)`);
        continue;
      }

      const existing = meetingMap.get(event.meetLink);
      const currentPriority = HOST_PRIORITY[host] ?? -1;
      const existingPriority = existing ? (HOST_PRIORITY[existing.host] ?? -1) : -1;

      if (!existing || currentPriority > existingPriority) {
        meetingMap.set(event.meetLink, { host, event });
      }
    }
  }

  let scheduled = 0;
  const details: string[] = [];
  const skippedDuplicates: string[] = [];

  for (const [meetLink, { host, event }] of meetingMap) {
    // Skip if a bot already exists for this meeting URL today
    if (existingMeetingUrls.has(meetLink)) continue;

    try {
      const recallBot = await createBot({
        meeting_url: meetLink,
        bot_name: "Asistente Comercial",
        join_at: event.start, // Recall will join at this exact time
      }) as { id: string };

      await supabase.from("recall_bots").insert({
        recall_bot_id: recallBot.id,
        meeting_url: meetLink,
        bot_name: "Asistente Comercial",
        host,
        status: "ready",
        meeting_title: event.summary || "Reunión",
      });

      existingMeetingUrls.add(meetLink);
      scheduled++;
      details.push(`${host}: ${event.summary} (${event.start})`);
      console.log(`[Auto-Schedule] Scheduled bot for "${event.summary}" (${host}) at ${event.start}`);
    } catch (err) {
      console.error(`[Auto-Schedule] Failed for ${host}:`, err);
    }
  }

  // Log deduplicated meetings for visibility
  for (const { host, events } of results) {
    for (const event of events) {
      if (!event.meetLink) continue;
      const winner = meetingMap.get(event.meetLink);
      if (winner && winner.host !== host) {
        skippedDuplicates.push(`${host}: "${event.summary}" → bot assigned to ${winner.host}`);
      }
    }
  }
  if (skippedDuplicates.length > 0) {
    console.log(`[Auto-Schedule] Deduplicated meetings:\n${skippedDuplicates.join("\n")}`);
  }
  if (skippedWeekly.length > 0) {
    console.log(`[Auto-Schedule] Skipped weekly recurring:\n${skippedWeekly.join("\n")}`);
  }

  return NextResponse.json({
    ok: true,
    scheduled,
    details,
    skippedDuplicates,
    skippedWeekly,
    timestamp: now.toISOString(),
  });
}
