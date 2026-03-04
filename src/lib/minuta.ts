import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptBlock {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface ParticipationEntry {
  name: string;
  pct: number;
}

export interface MinutaData {
  minutaReunion: string;
  fecha: string;
  asistentes: string;
  participacion: ParticipationEntry[];
  ordenDelDia: string[];
  pendientes: string[];
  resumen: string;
  conclusion: string;
}

export interface GenerateMinutaParams {
  title: string;
  date: string;
  host: string;
  duration: string;
  transcript: TranscriptBlock[];
}

export async function generateMinuta(params: GenerateMinutaParams): Promise<MinutaData> {
  const { title, date, host, duration, transcript } = params;

  if (!transcript || transcript.length === 0) {
    throw new Error("No hay transcripcion disponible para generar la minuta");
  }

  const transcriptText = transcript
    .map((b) => `[${b.timestamp}] ${b.speaker}: ${b.text}`)
    .join("\n");

  const systemPrompt = `Eres un asistente experto en generar minutas de reuniones profesionales en español.
Debes devolver UNICAMENTE un JSON valido (sin markdown, sin backticks, sin texto adicional) con exactamente estas claves:

{
  "minutaReunion": "Nombre exacto de la reunion tal como fue proporcionado",
  "fecha": "Fecha formateada en espanol (ej: 3 de Marzo, 2026 — 10:00 AM)",
  "asistentes": "Lista de asistentes separados por comas, extraidos de la transcripcion",
  "participacion": [
    { "name": "Nombre corto (ej: Andres L.)", "pct": 35 }
  ],
  "ordenDelDia": ["punto 1", "punto 2", "punto 3", "punto 4", "punto 5"],
  "pendientes": ["pendiente 1", "pendiente 2", "pendiente 3", "pendiente 4", "pendiente 5"],
  "resumen": "Resumen ejecutivo de exactamente 170 palabras",
  "conclusion": "Conclusion de exactamente 120 palabras"
}

REGLAS ESTRICTAS:
- Responde SOLO con el JSON, sin markdown ni explicaciones
- "participacion" es un ARRAY de objetos con "name" (nombre corto) y "pct" (porcentaje entero). Los porcentajes deben sumar 100. Calcula el porcentaje basandote en cuanto hablo cada participante en la transcripcion.
- "ordenDelDia" es un ARRAY de exactamente 5 strings: los 5 puntos clave de lo que trato la reunion.
- "pendientes" es un ARRAY de exactamente 5 strings: las 5 tareas o temas pendientes que surgieron. Incluye responsable y fecha si se mencionaron.
- "resumen" debe tener EXACTAMENTE 170 palabras. Ni mas ni menos.
- "conclusion" debe tener EXACTAMENTE 120 palabras. Ni mas ni menos.
- Extrae los nombres de los participantes de la transcripcion
- Todo en espanol, tono profesional y ejecutivo`;

  const userPrompt = `Genera la minuta de la siguiente reunion:

Titulo: ${title}
Fecha: ${date}
Anfitrion: ${host}
Duracion: ${duration}

Transcripcion:
${transcriptText}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const raw = completion.choices[0]?.message?.content || "{}";

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as MinutaData;
  } catch {
    return {
      minutaReunion: title,
      fecha: date,
      asistentes: "",
      participacion: [],
      ordenDelDia: [],
      pendientes: [],
      resumen: raw,
      conclusion: "",
    };
  }
}
