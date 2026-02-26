import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";
import { supabase } from "@/lib/supabase";

// GET /api/auth/callback — Google OAuth callback
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const host = req.nextUrl.searchParams.get("state"); // We passed host as state
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/bot-grabacion?auth_error=${error}`
    );
  }

  if (!code || !host) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/bot-grabacion?auth_error=missing_params`
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get the user's email from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert token in Supabase
    const { error: dbError } = await supabase
      .from("oauth_tokens")
      .upsert(
        {
          host,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          email: userInfo.email || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "host" }
      );

    if (dbError) {
      console.error("Failed to save tokens:", dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/bot-grabacion?auth_error=db_error`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/bot-grabacion?auth_success=${host}`
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/bot-grabacion?auth_error=token_exchange_failed`
    );
  }
}
