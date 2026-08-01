import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id with the parameters recommended by OWASP (19 MiB, 2 iterations).
 * Cost is deliberately paid on our side rather than pushed into a third-party
 * identity provider, which would mean sharing user data with another processor.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plain, OPTIONS);
  } catch {
    // A malformed stored hash must read as "wrong password", never as a crash.
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * A real hash of a random secret, used by the login route when no account
 * matches. Verifying against it costs the same as verifying a genuine hash, so
 * response time does not reveal whether an email address is registered.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummyHash;
}
