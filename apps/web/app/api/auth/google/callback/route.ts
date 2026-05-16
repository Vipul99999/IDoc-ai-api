import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { exchangeGoogleCode, fetchGoogleProfile } from "@/lib/auth/google";
import { permissionsForRole, signSession } from "@/lib/auth/jwt";
import { publicUser, upsertOAuthUser } from "@/lib/auth/users";

function appRedirect(path: string) {
  return new URL(path, process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

function redirectWithError(message: string) {
  const url = appRedirect("/");
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("google_oauth_state")?.value;
  const verifier = request.cookies.get("google_oauth_verifier")?.value;

  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return redirectWithError("Google sign-in state could not be verified.");
  }

  try {
    const token = await exchangeGoogleCode(code, verifier);
    const profile = await fetchGoogleProfile(token.access_token);
    const user = publicUser(
      await upsertOAuthUser({
        provider: "google",
        providerSubject: profile.sub,
        email: profile.email,
        name: profile.name ?? profile.email.split("@")[0],
        avatarUrl: profile.picture
      })
    );
    const sessionToken = signSession(user);
    const redirectUrl = appRedirect("/");
    redirectUrl.searchParams.set("token", sessionToken);
    redirectUrl.searchParams.set("auth", "google");
    redirectUrl.searchParams.set("sessionId", uuidv4());

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("google_oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
    response.cookies.set("google_oauth_verifier", "", { path: "/api/auth/google", maxAge: 0 });
    response.cookies.set("intellidoc_session", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60
    });
    response.cookies.set("intellidoc_user_role", user.role, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60
    });
    response.headers.set("x-intellidoc-permissions", permissionsForRole(user.role).join(","));
    return response;
  } catch (error) {
    return redirectWithError(error instanceof Error ? error.message : "Google sign-in failed.");
  }
}
