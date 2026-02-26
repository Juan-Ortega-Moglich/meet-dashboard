import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google";

// GET /api/calendar?host=Operaciones — Get calendar events for a host
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");
  const range = req.nextUrl.searchParams.get("range") || "today"; // "today" | "upcoming"

  if (!host) {
    return NextResponse.json({ error: "host is required" }, { status: 400 });
  }

  try {
    const now = new Date();

    let timeMin: string;
    let timeMax: string;

    if (range === "today") {
      // Start of today to end of today
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      timeMin = startOfDay.toISOString();
      timeMax = endOfDay.toISOString();
    } else {
      // Upcoming: from tomorrow to 7 days from now
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);
      timeMin = tomorrow.toISOString();
      timeMax = nextWeek.toISOString();
    }

    const events = await getCalendarEvents(host, timeMin, timeMax);

    return NextResponse.json({ events, authorized: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // If no token found, return unauthorized status
    if (message.includes("Authorization required")) {
      return NextResponse.json({ events: [], authorized: false });
    }

    console.error("Calendar API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
