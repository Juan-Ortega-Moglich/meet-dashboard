import { NextRequest, NextResponse } from "next/server";
import { generateMinuta } from "@/lib/minuta";

export async function POST(req: NextRequest) {
  try {
    const { title, date, host, duration, transcript } = await req.json();

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "No hay transcripción disponible para generar la minuta" },
        { status: 400 }
      );
    }

    const minuta = await generateMinuta({ title, date, host, duration, transcript });

    return NextResponse.json({ minuta });
  } catch (error) {
    console.error("Error generating minuta:", error);
    return NextResponse.json(
      { error: "Error al generar la minuta" },
      { status: 500 }
    );
  }
}
