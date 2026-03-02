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
  "minutaReunion": "Título o tema principal de la reunión",
  "fecha": "Fecha formateada de la reunión",
  "asistentes": "Lista de asistentes separados por comas, extraídos de la transcripción",
  "participacion": "Breve descripción del rol o participación de cada asistente",
  "ordenDelDia": "Puntos tratados en la reunión, cada uno en una línea nueva",
  "pendientes": "Tareas o temas que quedaron pendientes, cada uno en una línea nueva",
  "resumen": "Resumen ejecutivo de la reunión en 3-5 oraciones",
  "compromisos": "Compromisos y tareas asignadas con responsables, cada uno en una línea nueva",
  "conclusion": "Conclusión general de la reunión"
}

IMPORTANTE:
- Responde SOLO con el JSON, sin markdown ni explicaciones
- Extrae los nombres de los participantes de la transcripción
- Sé conciso y profesional
- Todo en español`;

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
        participacion: "",
        ordenDelDia: raw,
        pendientes: "",
        resumen: "",
        compromisos: "",
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
