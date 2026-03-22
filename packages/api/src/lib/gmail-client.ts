import { google } from "googleapis";
import { db, accounts } from "@trip/db";
import { and, eq } from "drizzle-orm";

export interface FetchedEmail {
  messageId: string; // Gmail Message-ID header for deduplication
  gmailId: string;   // Gmail internal message ID
  subject: string;
  fromAddress: string;
  receivedAt: Date;
  bodyText: string;
}

// ── OAuth2 client factory ──────────────────────────────────────────────────────

function makeOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

/**
 * Get an authenticated Gmail client for the given user.
 * Reads the stored OAuth tokens from the accounts table and auto-refreshes if needed.
 */
async function getGmailClient(userId: string) {
  const account = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, userId),
      eq(accounts.providerId, "google")
    ),
  });

  if (!account) {
    throw new Error("No Google account linked — please sign in with Google");
  }
  if (!account.refreshToken) {
    throw new Error(
      "No Gmail refresh token — please sign out and sign in again to grant Gmail access"
    );
  }

  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.accessTokenExpiresAt?.getTime(),
  });

  // googleapis will auto-refresh the access token using the refresh token
  return google.gmail({ version: "v1", auth: oauth2 });
}

// ── Email body extraction ──────────────────────────────────────────────────────

function decodeBase64Url(encoded: string): string {
  // Gmail uses base64url encoding (- instead of +, _ instead of /)
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

/**
 * Recursively extract plain text from a Gmail message part tree.
 * Prefers text/plain; falls back to text/html with tags stripped.
 */
function extractText(part: GmailPart): string {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  if (part.parts) {
    // Try plain text first across all children
    for (const child of part.parts) {
      if (child.mimeType === "text/plain" && child.body?.data) {
        return decodeBase64Url(child.body.data);
      }
    }
    // Fall back to HTML stripped
    for (const child of part.parts) {
      const text = extractText(child);
      if (text) return text;
    }
  }

  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return "";
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch unread emails from the user's Gmail inbox using the Gmail API.
 * Marks each message as read after fetching.
 * Returns parsed emails ready for the booking parser.
 */
export async function fetchUnseenEmails(
  userId: string,
  maxMessages = 20
): Promise<FetchedEmail[]> {
  const gmail = await getGmailClient(userId);

  // List unread messages — Gmail query syntax
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread",
    maxResults: maxMessages,
  });

  const messageRefs = listRes.data.messages ?? [];
  if (messageRefs.length === 0) return [];

  const results: FetchedEmail[] = [];

  for (const ref of messageRefs) {
    if (!ref.id) continue;

    try {
      // Fetch full message
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: ref.id,
        format: "full",
      });

      const msg = msgRes.data;
      const headers = msg.payload?.headers ?? [];

      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";

      const subject = getHeader("Subject") || "(no subject)";
      const fromAddress = getHeader("From") || "Unknown";
      const messageId = getHeader("Message-ID") || `gmail-${ref.id}`;
      const dateStr = getHeader("Date");
      const receivedAt = dateStr ? new Date(dateStr) : new Date();

      // Extract body text
      const bodyText = msg.payload ? extractText(msg.payload as GmailPart) : "";

      // Skip very short/empty bodies
      if (bodyText.length < 100) {
        await markAsRead(gmail, ref.id);
        continue;
      }

      results.push({
        messageId,
        gmailId: ref.id,
        subject,
        fromAddress,
        receivedAt,
        bodyText: bodyText.slice(0, 8000), // cap for Claude
      });

      // Mark as read so we don't reprocess it
      await markAsRead(gmail, ref.id);
    } catch (err) {
      console.warn(`[Gmail] Failed to fetch message ${ref.id}:`, err);
    }
  }

  return results;
}

async function markAsRead(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
) {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}
