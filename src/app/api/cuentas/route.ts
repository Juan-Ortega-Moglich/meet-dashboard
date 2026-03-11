import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Host definitions (same as bot-grabacion page)
const ALL_HOSTS = [
  { id: "operaciones", name: "Operaciones", calendarType: "google" as const },
  { id: "andres", name: "Andres", calendarType: "google" as const },
  { id: "pablo", name: "Pablo", calendarType: "google" as const },
  { id: "rafa", name: "Rafa", calendarType: "google" as const },
  { id: "wisdom", name: "Wisdom", calendarType: "ics" as const },
  { id: "biofleming", name: "Biofleming", calendarType: "google" as const },
  { id: "inbest", name: "Inbest", calendarType: "google" as const },
  { id: "blindaje360", name: "Blindaje360", calendarType: "google" as const },
];

// GET /api/cuentas — List all accounts with their OAuth status
export async function GET() {
  try {
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

    // For each Google host, test if the refresh token actually works
    const accounts = await Promise.all(
      ALL_HOSTS.map(async (host) => {
        const token = tokenMap.get(host.name);

        if (host.calendarType === "ics") {
          return {
            id: host.id,
            name: host.name,
            calendarType: host.calendarType,
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
            id: host.id,
            name: host.name,
            calendarType: host.calendarType,
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

            // If refresh worked, update the stored token
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
          id: host.id,
          name: host.name,
          calendarType: host.calendarType,
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
