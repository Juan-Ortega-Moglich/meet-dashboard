import { supabase } from "./supabase";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive";

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

// --- Google Drive helpers ---

// Find a folder by name inside a parent folder (or root)
export async function findDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string | null> {
  const q = parentId
    ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1" });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

// Create a folder in Drive
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create folder: ${error}`);
  }

  const data = await res.json();
  return data.id;
}

// Upload a PDF to Drive (multipart upload)
export async function uploadPdfToDrive(
  accessToken: string,
  fileName: string,
  pdfBase64: string,
  folderId?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: "application/pdf",
  };
  if (folderId) metadata.parents = [folderId];

  // Build multipart body
  const boundary = "minuta_upload_boundary";
  const pdfBytes = Buffer.from(pdfBase64, "base64");

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    pdfBytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to upload PDF: ${error}`);
  }

  return res.json();
}

// Make a file viewable by anyone with the link
export async function shareDriveFile(accessToken: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
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
  isWeeklyRecurring?: boolean;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (data.items || []).filter(
    (event: { status: string }) => event.status !== "cancelled"
  );

  // Collect unique recurringEventIds to batch-check weekly recurrence
  const recurringIds = new Set<string>();
  for (const event of items) {
    if (event.recurringEventId) recurringIds.add(event.recurringEventId);
  }

  // Fetch parent events to check if they have FREQ=WEEKLY
  const weeklyParents = new Set<string>();
  await Promise.all(
    Array.from(recurringIds).map(async (parentId) => {
      try {
        const parentRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(parentId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!parentRes.ok) return;
        const parent = await parentRes.json();
        const recurrence: string[] = parent.recurrence || [];
        if (recurrence.some((r: string) => r.toUpperCase().includes("FREQ=WEEKLY"))) {
          weeklyParents.add(parentId);
        }
      } catch {
        // Ignore — treat as non-recurring
      }
    })
  );

  return items.map((event) => {
    // Extract Google Meet link
    let meetLink = event.hangoutLink || null;
    if (!meetLink && event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find(
        (ep: { entryPointType: string }) => ep.entryPointType === "video"
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
      isWeeklyRecurring: weeklyParents.has(event.recurringEventId),
    };
  });
}
