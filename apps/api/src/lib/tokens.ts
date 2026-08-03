import { createHash, randomBytes } from "node:crypto";

/**
 * Every secret this app hands out — session tokens, and the links mailed for
 * address confirmation and password reset — is a random 32-byte value stored
 * only as its SHA-256 hash.
 *
 * No salt and no slow hash on purpose, unlike passwords: these are full-entropy
 * random strings, so there is nothing to guess and nothing to look up in a
 * rainbow table. Hashing them at all is what makes a database dump useless to
 * whoever ends up holding it.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
