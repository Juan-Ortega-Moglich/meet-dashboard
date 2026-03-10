const RECALL_API_KEY = process.env.RECALL_API_KEY!;
const RECALL_REGION = process.env.RECALL_REGION || "us-west-2";
const BASE_URL = `https://${RECALL_REGION}.recall.ai/api/v1`;

interface RecallRequestOptions {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

export async function recallFetch<T>({ method, path, body }: RecallRequestOptions): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Token ${RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Recall API error ${res.status}: ${error}`);
  }

  return res.json();
}

export interface CreateBotParams {
  meeting_url: string;
  bot_name?: string;
  join_at?: string;
}

export async function createBot(params: CreateBotParams) {
  return recallFetch({
    method: "POST",
    path: "/bot/",
    body: {
      meeting_url: params.meeting_url,
      bot_name: params.bot_name || "Asistente Comercial",
      ...(params.join_at ? { join_at: params.join_at } : {}),
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              mode: "prioritize_accuracy",
              language: "auto",
            },
          },
        },
        audio_mixed_mp3: {},
      },
      automatic_leave: {
        silence_detection: {
          timeout: 300,
          activate_after: 60,
        },
        everyone_left_timeout: {
          timeout: 2,
          activate_after: 1,
        },
        noone_joined_timeout: 300,
        waiting_room_timeout: 300,
      },
    },
  });
}

export async function getBot(botId: string) {
  return recallFetch({
    method: "GET",
    path: `/bot/${botId}/`,
  });
}

export async function removeBot(botId: string) {
  return recallFetch({
    method: "POST",
    path: `/bot/${botId}/leave_call/`,
  });
}

export async function listBots() {
  return recallFetch({
    method: "GET",
    path: "/bot/",
  });
}

export async function deleteBot(botId: string) {
  const res = await fetch(`${BASE_URL}/bot/${botId}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Token ${RECALL_API_KEY}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const error = await res.text();
    throw new Error(`Recall API delete error ${res.status}: ${error}`);
  }
}

// Recall transcript format from the download URL
interface RecallTranscriptEntry {
  participant: {
    id: number;
    name: string;
    is_host?: boolean;
    email?: string | null;
  };
  words: Array<{
    text: string;
    start_timestamp: { relative: number; absolute: string };
    end_timestamp: { relative: number; absolute: string };
  }>;
}

export async function getBotTranscript(
  botId: string
): Promise<Array<{ timestamp: string; speaker: string; text: string }>> {
  // Get bot data to find the transcript download URL
  const bot = await getBot(botId) as {
    recordings: Array<{
      media_shortcuts: {
        transcript?: {
          data: { download_url: string };
        };
      };
    }>;
  };

  const transcriptUrl = bot.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url;
  if (!transcriptUrl) return [];

  // Fetch the actual transcript JSON from S3
  const res = await fetch(transcriptUrl);
  if (!res.ok) return [];

  const data: RecallTranscriptEntry[] = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter((entry) => entry.words?.some((w) => w.text.trim()))
    .map((entry) => {
      const startSec = entry.words?.[0]?.start_timestamp?.relative || 0;
      const minutes = Math.floor(startSec / 60);
      const seconds = Math.floor(startSec % 60);
      return {
        timestamp: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        speaker: entry.participant?.name || `Participante ${entry.participant?.id || 0}`,
        text: entry.words?.map((w) => w.text).join(" ").trim() || "",
      };
    })
    .filter((entry) => entry.text.length > 0);
}
