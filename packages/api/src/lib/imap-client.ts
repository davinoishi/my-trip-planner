import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";

export interface FetchedEmail {
  messageId: string; // Gmail Message-ID header for deduplication
  uid: number;
  subject: string;
  fromAddress: string;
  receivedAt: Date;
  bodyText: string;  // plain text (HTML stripped)
}

function getImapConfig() {
  const host = process.env.IMAP_HOST;
  const port = parseInt(process.env.IMAP_PORT ?? "993", 10);
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error(
      "IMAP not configured — set IMAP_HOST, IMAP_USER, IMAP_PASSWORD in .env"
    );
  }
  return { host, port, user, password };
}

/**
 * Fetch unseen emails from the configured Gmail inbox.
 * Marks each fetched message as SEEN so it won't be fetched again.
 * Returns parsed emails ready for the booking parser.
 */
export async function fetchUnseenEmails(
  maxMessages = 20
): Promise<FetchedEmail[]> {
  const { host, port, user, password } = getImapConfig();

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass: password },
    logger: false, // silence verbose IMAP logs
  });

  const results: FetchedEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for unseen messages — newest first, capped at maxMessages
      const uids: number[] = [];
      for await (const msg of client.fetch("1:*", { flags: true })) {
        if (msg.flags && !msg.flags.has("\\Seen")) uids.push(msg.uid);
      }

      // Process newest first, respect cap
      const toFetch = uids.slice(-maxMessages).reverse();

      for (const uid of toFetch) {
        try {
          const msg = await client.fetchOne(String(uid), {
            source: true,
          }, { uid: true });

          if (!msg || !("source" in msg) || !(msg as any).source) continue;

          const parsed: ParsedMail = await simpleParser((msg as any).source);

          // Extract plain text — fall back to HTML-stripped if no text part
          let bodyText = parsed.text ?? "";
          if (!bodyText && parsed.html) {
            bodyText = parsed.html
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim();
          }

          // Skip very short/empty bodies — likely tracking pixels or empty replies
          if (bodyText.length < 100) continue;

          // Use Message-ID header for dedup; fall back to uid@user
          const msgId =
            (Array.isArray(parsed.messageId)
              ? parsed.messageId[0]
              : parsed.messageId) ?? `uid-${uid}@${user}`;

          const from = parsed.from?.value?.[0];
          const fromAddress = from
            ? `${from.name ? from.name + " <" : ""}${from.address ?? ""}${from.name ? ">" : ""}`
            : "Unknown";

          results.push({
            messageId: msgId,
            uid,
            subject: parsed.subject ?? "(no subject)",
            fromAddress,
            receivedAt: parsed.date ?? new Date(),
            bodyText: bodyText.slice(0, 8000), // cap at 8k chars for Claude
          });

          // Mark as seen so we don't reprocess it
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        } catch (err) {
          console.warn(`[IMAP] Failed to fetch UID ${uid}:`, err);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return results;
}

