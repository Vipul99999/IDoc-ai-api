import crypto from "node:crypto";

export type GoogleOAuthSession = {
  state: string;
  verifier: string;
  authorizationUrl: string;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  hd?: string;
};

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`;
}

export function buildGoogleOAuthSession(): GoogleOAuthSession {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");

  const state = base64url(crypto.randomBytes(24));
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", clientId);
  authorization.searchParams.set("redirect_uri", googleRedirectUri());
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("access_type", "offline");
  authorization.searchParams.set("prompt", "select_account");

  return { state, verifier, authorizationUrl: authorization.toString() };
}

export function validateGoogleHostedDomain(profile: GoogleProfile) {
  const allowed = (process.env.GOOGLE_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return;
  const emailDomain = profile.email.split("@")[1]?.toLowerCase();
  if (!emailDomain || !allowed.includes(emailDomain)) {
    throw new Error("This Google account is not allowed for this workspace.");
  }
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description ?? payload.error ?? "Google token exchange failed.");
  return payload as { access_token: string; id_token?: string; expires_in: number; token_type: string };
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = (await response.json()) as GoogleProfile;
  if (!response.ok) throw new Error("Could not load Google profile.");
  if (!profile.email || !profile.sub || !profile.email_verified) throw new Error("Google account email must be verified.");
  validateGoogleHostedDomain(profile);
  return profile;
}
