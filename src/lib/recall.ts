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
      bot_name: params.bot_name || "Möglich Bot",
      ...(params.join_at ? { join_at: params.join_at } : {}),
      recording_config: {
        transcript: {
          provider: {
            meeting_captions: {},
          },
        },
        video_mixed_mp4: {},
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

export async function listBots() {
  return recallFetch({
    method: "GET",
    path: "/bot/",
  });
}

export interface TranscriptEntry {
  words: Array<{ text: string; start_timestamp: number }>;
  speaker: string;
  speaker_id?: number;
}

export async function getBotTranscript(
  botId: string
): Promise<Array<{ timestamp: string; speaker: string; text: string }>> {
  const data = await recallFetch<TranscriptEntry[]>({
    method: "GET",
    path: `/bot/${botId}/transcript/`,
  });

  if (!Array.isArray(data)) return [];

  return data.map((entry) => {
    const startSec = entry.words?.[0]?.start_timestamp || 0;
    const minutes = Math.floor(startSec / 60);
    const seconds = Math.floor(startSec % 60);
    return {
      timestamp: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      speaker: entry.speaker || `Speaker ${entry.speaker_id || 0}`,
      text: entry.words?.map((w) => w.text).join(" ") || "",
    };
  });
}
