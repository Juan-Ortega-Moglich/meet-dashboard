import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Hardcoded defaults (fallback if hosts table doesn't exist)
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

async function getHosts(): Promise<{ name: string; calendar_type: string }[]> {
  try {
    const { data, error } = await supabase
      .from("hosts")
      .select("name, calendar_type")
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) return DEFAULT_HOSTS;
    return data;
  } catch {
    return DEFAULT_HOSTS;
  }
}

// GET /api/cuentas — List all accounts with their OAuth status
export async function GET() {
  try {
    const allHosts = await getHosts();

    // Fetch all tokens from Supabase
    const { data: tokens, error } = await supabase
      .from("oauth_tokens")
      .select("host, email, token_expiry, updated_at, refresh_token");

    if (error) {
      console.error("Failed to fetch tokens:", error);
      return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
    }

    const tokenMap = new Map(
      (tokens || []).map((t) => [t.host, t])
    );

    // For each host, test if the refresh token actually works
    const accounts = await Promise.all(
      allHosts.map(async (host) => {
        const token = tokenMap.get(host.name);
        const id = host.name.toLowerCase().replace(/\s+/g, "-");

        if (host.calendar_type === "ics") {
          return {
            id,
            name: host.name,
            calendarType: host.calendar_type as "google" | "ics",
            connected: true,
            email: null,
            status: "ics" as const,
            lastUpdated: null,
            tokenExpiry: null,
            error: null,
          };
        }

        if (!token) {
          return {
            id,
            name: host.name,
            calendarType: host.calendar_type as "google" | "ics",
            connected: false,
            email: null,
            status: "no_token" as const,
            lastUpdated: null,
            tokenExpiry: null,
            error: null,
          };
        }

        // Test if the token is valid by trying to refresh it
        let status: "valid" | "expired" | "error" = "valid";
        let errorMsg: string | null = null;

        try {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: token.refresh_token,
              grant_type: "refresh_token",
            }),
          });

          if (!refreshRes.ok) {
            const errData = await refreshRes.json();
            status = "expired";
            errorMsg = errData.error_description || errData.error || "Token inválido";
          } else {
            const refreshData = await refreshRes.json();
            const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
            await supabase
              .from("oauth_tokens")
              .update({
                access_token: refreshData.access_token,
                token_expiry: newExpiry,
                updated_at: new Date().toISOString(),
              })
              .eq("host", host.name);
          }
        } catch (err) {
          status = "error";
          errorMsg = err instanceof Error ? err.message : "Error desconocido";
        }

        return {
          id,
          name: host.name,
          calendarType: host.calendar_type as "google" | "ics",
          connected: status === "valid",
          email: token.email || null,
          status,
          lastUpdated: token.updated_at,
          tokenExpiry: token.token_expiry,
          error: errorMsg,
        };
      })
    );

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("Cuentas API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
