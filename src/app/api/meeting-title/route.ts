import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google";
import { getIcsUrl, getIcsCalendarEvents } from "@/lib/ical";
import { supabase } from "@/lib/supabase";

const allHosts = ["Operaciones", "Andres", "Pablo", "Rafa", "Wisdom", "Biofleming", "Inbest"];

// GET /api/meeting-title?url=https://meet.google.com/xxx
export async function GET(req: NextRequest) {
  const meetingUrl = req.nextUrl.searchParams.get("url");

  if (!meetingUrl) {
    return NextResponse.json({ title: null });
  }

  // Wide range: today ± 1 day to catch ongoing and upcoming meetings
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(now);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 7);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const timeMin = startOfDay.toISOString();
  const timeMax = endOfTomorrow.toISOString();

  // Search across all hosts' calendars
  for (const host of allHosts) {
    try {
      let events;

      if (getIcsUrl(host)) {
        events = await getIcsCalendarEvents(host, timeMin, timeMax);
      } else {
        // Check if host has Google OAuth token
        const { data: token } = await supabase
          .from("oauth_tokens")
          .select("host")
          .eq("host", host)
          .single();

        if (!token) continue;
        events = await getCalendarEvents(host, timeMin, timeMax);
      }

      // Match by meeting link
      const match = events.find((e) => {
        if (!e.meetLink) return false;
        // Normalize URLs for comparison
        const normalize = (url: string) => url.replace(/\/$/, "").toLowerCase();
        return normalize(meetingUrl).includes(normalize(e.meetLink)) ||
               normalize(e.meetLink).includes(normalize(meetingUrl));
      });

      if (match) {
        return NextResponse.json({ title: match.summary });
      }
    } catch {
      // Skip this host on error, try next
    }
  }

  return NextResponse.json({ title: null });
}
