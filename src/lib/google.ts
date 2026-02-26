import { supabase } from "./supabase";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

// Build the Google OAuth2 authorization URL
export function getAuthUrl(host: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: host,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange auth code for tokens
export async function exchangeCodeForTokens(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

// Refresh an access token using the stored refresh token
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Get a valid access token for a host (refreshes if expired)
export async function getAccessToken(host: string): Promise<string> {
  const { data: tokenRecord, error } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("host", host)
    .single();

  if (error || !tokenRecord) {
    throw new Error(`No OAuth token found for host: ${host}. Authorization required.`);
  }

  // Check if token is still valid (with 5 min buffer)
  const now = new Date();
  const expiry = tokenRecord.token_expiry ? new Date(tokenRecord.token_expiry) : new Date(0);

  if (now < new Date(expiry.getTime() - 5 * 60 * 1000)) {
    return tokenRecord.access_token;
  }

  // Refresh the token
  const newAccessToken = await refreshAccessToken(tokenRecord.refresh_token);
  const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

  await supabase
    .from("oauth_tokens")
    .update({
      access_token: newAccessToken,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("host", host);

  return newAccessToken;
}

// Fetch calendar events from Google Calendar API
export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  meetLink: string | null;
  organizer: string;
  status: string;
}

export async function getCalendarEvents(
  host: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken(host);

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendar API error: ${error}`);
  }

  const data = await res.json();

  return (data.items || [])
    .filter((event: { status: string }) => event.status !== "cancelled")
    .map((event: {
      id: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      hangoutLink?: string;
      conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
      organizer?: { email?: string; displayName?: string };
      status: string;
    }) => {
      // Extract Google Meet link
      let meetLink = event.hangoutLink || null;
      if (!meetLink && event.conferenceData?.entryPoints) {
        const videoEntry = event.conferenceData.entryPoints.find(
          (ep) => ep.entryPointType === "video"
        );
        if (videoEntry) meetLink = videoEntry.uri;
      }

      return {
        id: event.id,
        summary: event.summary || "Sin título",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        meetLink,
        organizer: event.organizer?.displayName || event.organizer?.email || "",
        status: event.status,
      };
    });
}
