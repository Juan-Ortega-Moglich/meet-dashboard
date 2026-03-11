import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Hardcoded defaults — these are always present even if the table doesn't exist yet
const DEFAULT_HOSTS = [
  { name: "Operaciones", calendar_type: "google" },
  { name: "Andres", calendar_type: "google" },
  { name: "Pablo", calendar_type: "google" },
  { name: "Rafa", calendar_type: "google" },
  { name: "Wisdom", calendar_type: "ics" },
  { name: "Biofleming", calendar_type: "google" },
  { name: "Inbest", calendar_type: "google" },
  { name: "Blindaje360", calendar_type: "google" },
];

// GET /api/hosts — List all hosts
export async function GET() {
  try {
    // Try to read from Supabase hosts table
    const { data, error } = await supabase
      .from("hosts")
      .select("name, calendar_type")
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      // Fallback to defaults if table doesn't exist or is empty
      return NextResponse.json({ hosts: DEFAULT_HOSTS, source: "defaults" });
    }

    return NextResponse.json({ hosts: data, source: "database" });
  } catch {
    return NextResponse.json({ hosts: DEFAULT_HOSTS, source: "defaults" });
  }
}

// POST /api/hosts — Add a new host
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, calendar_type = "google" } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if host already exists
    const { data: existing } = await supabase
      .from("hosts")
      .select("name")
      .eq("name", trimmedName)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Este host ya existe" }, { status: 409 });
    }

    // Insert new host
    const { error } = await supabase
      .from("hosts")
      .insert({
        name: trimmedName,
        calendar_type: calendar_type === "ics" ? "ics" : "google",
      });

    if (error) {
      console.error("Failed to insert host:", error);
      return NextResponse.json({ error: "Error al guardar el host" }, { status: 500 });
    }

    return NextResponse.json({ success: true, host: { name: trimmedName, calendar_type } });
  } catch (err) {
    console.error("Hosts POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/hosts — Remove a host
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("hosts")
      .delete()
      .eq("name", name);

    if (error) {
      console.error("Failed to delete host:", error);
      return NextResponse.json({ error: "Error al eliminar el host" }, { status: 500 });
    }

    // Also clean up OAuth token for this host
    await supabase.from("oauth_tokens").delete().eq("host", name);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Hosts DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
