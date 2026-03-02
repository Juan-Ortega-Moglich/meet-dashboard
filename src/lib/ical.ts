import { CalendarEvent } from "./google";

// Map of hosts that use Outlook ICS instead of Google Calendar
const icsHosts: Record<string, string | undefined> = {
  Wisdom: process.env.OUTLOOK_ICS_WISDOM,
};

export function getIcsUrl(host: string): string | null {
  return icsHosts[host] || null;
}

// Parse an ICS DTSTART/DTEND value into a Date
function parseIcsDate(value: string, tzLine?: string): Date {
  // Format: DTSTART;TZID=Central Standard Time (Mexico):20251202T100000
  // or: DTSTART:20251202T100000Z
  const dateStr = value.includes(":") ? value.split(":").pop()! : value;

  if (dateStr.endsWith("Z")) {
    // UTC
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    const h = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    const s = dateStr.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
  }

  // Local time (with TZID) — parse as local
  const clean = dateStr.replace(/[^\dT]/g, "");
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(9, 11) || "00";
  const min = clean.slice(11, 13) || "00";
  const s = clean.slice(13, 15) || "00";

  // If TZID contains "Mexico" or "Central", treat as UTC-6
  const tz = tzLine || value;
  if (tz.includes("Mexico") || tz.includes("Central Standard Time")) {
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}-06:00`);
  }

  // Default: parse as local time
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s));
}

// Unfold ICS lines (lines starting with space are continuations)
function unfoldLines(raw: string): string[] {
  return raw.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r?\n/);
}

// Extract Teams meeting link from DESCRIPTION
function extractTeamsLink(description: string): string | null {
  // Look for teams.live.com/meet/ or teams.microsoft.com/l/meetup-join
  const patterns = [
    /https:\/\/teams\.live\.com\/meet\/[^\s<>)\\]+/,
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>)\\]+/,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[0];
  }
  return null;
}

export async function getIcsCalendarEvents(
  host: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const icsUrl = getIcsUrl(host);
  if (!icsUrl) throw new Error(`No ICS URL configured for host: ${host}`);

  const res = await fetch(icsUrl, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch ICS calendar: ${res.status}`);

  const icsText = await res.text();
  const lines = unfoldLines(icsText);

  const minDate = new Date(timeMin);
  const maxDate = new Date(timeMax);

  const events: CalendarEvent[] = [];
  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;

      const dtStart = current["DTSTART"] || "";
      const dtEnd = current["DTEND"] || "";
      const summary = current["SUMMARY"] || "Sin título";
      const description = current["DESCRIPTION"] || "";
      const uid = current["UID"] || Math.random().toString(36);
      const location = current["LOCATION"] || "";

      const startDate = parseIcsDate(dtStart);
      const endDate = parseIcsDate(dtEnd);

      // Filter by date range
      if (startDate >= minDate && startDate <= maxDate) {
        // Extract meeting link from description or location
        let meetLink = extractTeamsLink(description);
        if (!meetLink && location.includes("teams")) {
          meetLink = extractTeamsLink(location);
        }

        events.push({
          id: uid.slice(0, 40),
          summary: summary.replace(/\\,/g, ",").replace(/\\n/g, " ").trim(),
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          meetLink,
          organizer: host,
          status: "confirmed",
        });
      }

      continue;
    }

    if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).split(";")[0];
      const fullValue = line;
      // Store both the raw line (for DTSTART/DTEND with TZID) and extracted value
      if (key === "DTSTART" || key === "DTEND") {
        current[key] = fullValue;
      } else {
        current[key] = line.slice(colonIdx + 1);
      }
    }
  }

  // Sort by start time
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return events;
}
