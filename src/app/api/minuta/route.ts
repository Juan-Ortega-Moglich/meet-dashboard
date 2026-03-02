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

    const systemPrompt = `Eres un asistente experto en generar minutas de reuniones profesionales.
Genera minutas claras, estructuradas y en español.
La minuta debe incluir:
1. **Datos de la reunión** (título, fecha, anfitrión, duración)
2. **Participantes** (extraídos de la transcripción)
3. **Resumen ejecutivo** (2-3 oraciones)
4. **Puntos tratados** (temas discutidos con detalle)
5. **Acuerdos y compromisos** (acciones concretas con responsables si se mencionan)
6. **Próximos pasos** (si se mencionan)

Formato la minuta en markdown limpio y profesional.`;

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

    const minuta = completion.choices[0]?.message?.content || "No se pudo generar la minuta.";

    return NextResponse.json({ minuta });
  } catch (error) {
    console.error("Error generating minuta:", error);
    return NextResponse.json(
      { error: "Error al generar la minuta" },
      { status: 500 }
    );
  }
}
