import { NextResponse } from "next/server";
import { buildGoogleOAuthSession, googleOAuthConfigured } from "@/lib/auth/google";
import { json } from "@/lib/http";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/google",
  maxAge: 10 * 60
};

export async function GET() {
  if (!googleOAuthConfigured()) {
    return json({ error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." }, 503);
  }

  const session = buildGoogleOAuthSession();
  const response = NextResponse.redirect(session.authorizationUrl);
  response.cookies.set("google_oauth_state", session.state, cookieOptions);
  response.cookies.set("google_oauth_verifier", session.verifier, cookieOptions);
  return response;
}
