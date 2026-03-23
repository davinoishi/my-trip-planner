import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

/**
 * Initiates an incremental Google OAuth authorization to add gmail.readonly scope
 * to an existing authenticated account.
 *
 * Uses include_granted_scopes=true so previously granted scopes are preserved.
 * After the user approves, Google redirects to the existing Better Auth callback
 * which updates the account's stored tokens.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/callback/google`;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    // Pass a state param so the callback knows to redirect back to /import
    state: Buffer.from(JSON.stringify({ callbackUrl: "/import" })).toString("base64url"),
  });

  return NextResponse.redirect(authUrl);
}
