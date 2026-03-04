import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/google";

const SHEET_ID = process.env.CLAY_SHEET_ID || "1GgdBrwod_zmMV5qlXPIAYxYAVXXUFmvFF8IdrRBpfgY";

// GET /api/clay — Read Clay Google Sheet data via Drive export
export async function GET() {
  try {
    const accessToken = await getAccessToken("Operaciones");

    // Export the sheet as CSV using Drive API (works with drive scope)
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${SHEET_ID}/export?mimeType=text/csv`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const error = await res.text();
      console.error("[Clay] Sheet export failed:", error);
      return NextResponse.json({ error: "No se pudo leer la hoja de Clay" }, { status: 500 });
    }

    const csv = await res.text();
    const rows = parseCSV(csv);

    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // First row = headers
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const data = rows.slice(1)
      .filter((row) => row.some((cell) => cell.trim() !== ""))
      .map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((header, i) => {
          obj[header] = row[i]?.trim() || "";
        });
        return obj;
      })
      .reverse(); // Most recent at the top

    return NextResponse.json({ data, headers });
  } catch (err) {
    console.error("[Clay] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al leer datos de Clay" },
      { status: 500 }
    );
  }
}

// Simple CSV parser that handles quoted fields
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current);
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current);
        current = "";
        if (row.length > 0) rows.push(row);
        row = [];
        if (char === "\r") i++; // skip \n after \r
      } else {
        current += char;
      }
    }
  }

  // Last field/row
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}
