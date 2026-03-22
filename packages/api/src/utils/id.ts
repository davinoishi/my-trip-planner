import { randomBytes } from "crypto";

/**
 * Generates a URL-safe random ID (21 chars, similar to nanoid).
 */
export function nanoid(): string {
  return randomBytes(16).toString("base64url").slice(0, 21);
}
