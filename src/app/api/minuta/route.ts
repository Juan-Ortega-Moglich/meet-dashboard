import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { title, date, host, duration, transcript } = await req.json();

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "No hay transcripción disponible para generar la minuta" },
        { status: 400 }
      );
    }

    const transcriptText = transcript
      .map((b: { timestamp: string; speaker: string; text: string }) =>
        `[${b.timestamp}] ${b.speaker}: ${b.text}`
      )
      .join("\n");

    const systemPrompt = `Eres un asistente experto en generar minutas de reuniones profesionales en español.
Debes devolver ÚNICAMENTE un JSON válido (sin markdown, sin backticks, sin texto adicional) con exactamente estas claves:

{
  "minutaReunion": "Nombre exacto de la reunión tal como fue proporcionado",
  "fecha": "Fecha formateada en español (ej: 3 de Marzo, 2026 — 10:00 AM)",
  "asistentes": "Lista de asistentes separados por comas, extraídos de la transcripción",
  "participacion": [
    { "name": "Nombre corto (ej: Andrés L.)", "pct": 35 }
  ],
  "ordenDelDia": ["punto 1", "punto 2", "punto 3", "punto 4", "punto 5"],
  "pendientes": ["pendiente 1", "pendiente 2", "pendiente 3", "pendiente 4", "pendiente 5"],
  "resumen": "Resumen ejecutivo de exactamente 100 palabras",
  "conclusion": "Conclusión de exactamente 70 palabras"
}

REGLAS ESTRICTAS:
- Responde SOLO con el JSON, sin markdown ni explicaciones
- "participacion" es un ARRAY de objetos con "name" (nombre corto) y "pct" (porcentaje entero). Los porcentajes deben sumar 100. Calcula el porcentaje basándote en cuánto habló cada participante en la transcripción.
- "ordenDelDia" es un ARRAY de exactamente 5 strings: los 5 puntos clave de lo que trató la reunión.
- "pendientes" es un ARRAY de exactamente 5 strings: las 5 tareas o temas pendientes que surgieron. Incluye responsable y fecha si se mencionaron.
- "resumen" debe tener EXACTAMENTE 100 palabras. Ni más ni menos.
- "conclusion" debe tener EXACTAMENTE 70 palabras. Ni más ni menos.
- Extrae los nombres de los participantes de la transcripción
- Todo en español, tono profesional y ejecutivo`;

    const userPrompt = `Genera la minuta de la siguiente reunión:

Título: ${title}
Fecha: ${date}
Anfitrión: ${host}
Duración: ${duration}

Transcripción:
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

    // Parse the JSON response
    let minuta;
    try {
      // Remove potential markdown code fences
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      minuta = JSON.parse(cleaned);
    } catch {
      // Fallback: return as unstructured
      minuta = {
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

    return NextResponse.json({ minuta });
  } catch (error) {
    console.error("Error generating minuta:", error);
    return NextResponse.json(
      { error: "Error al generar la minuta" },
      { status: 500 }
    );
  }
}
