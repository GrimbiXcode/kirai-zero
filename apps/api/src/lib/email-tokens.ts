import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { EmailTokenPurpose } from "shared";
import type { Database, Executor } from "../db/client";
import { emailTokens, users } from "../db/schema";
import { generateToken, hashToken } from "./tokens";

/**
 * How long a mailed link stays valid.
 *
 * The verification link is generous: it competes with a spam folder and a
 * person who reads their mail on Sunday, and losing it costs nothing but a
 * banner. The reset link is short, because for the length of that window the
 * link *is* the account.
 */
const TTL_MINUTES: Record<EmailTokenPurpose, number> = {
  verify_email: 7 * 24 * 60,
  password_reset: 60,
};

export function tokenTtlMinutes(purpose: EmailTokenPurpose): number {
  return TTL_MINUTES[purpose];
}

/**
 * Issues a fresh token and invalidates the account's earlier ones of the same
 * purpose. Someone who clicks "send again" twice should not be left guessing
 * which of the two mails is the live one — it is always the newest.
 */
export async function issueToken(
  db: Database,
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .delete(emailTokens)
      .where(
        and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose)),
      );
    await tx
      .insert(emailTokens)
      .values({ userId, purpose, tokenHash: hashToken(token), expiresAt });
  });

  return { token, expiresAt };
}

/**
 * Redeems a token, once. The row is deleted in the same statement that reads
 * it, so two requests arriving together cannot both come away with a userId.
 *
 * Deleted accounts are excluded: their identifying fields are overwritten the
 * moment they ask to be removed, and a token issued before that must not be a
 * way back in.
 */
export async function consumeToken(
  db: Database,
  token: string,
  purpose: EmailTokenPurpose,
): Promise<{ userId: string } | null> {
  const rows = await db
    .delete(emailTokens)
    .where(
      and(
        eq(emailTokens.tokenHash, hashToken(token)),
        eq(emailTokens.purpose, purpose),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: emailTokens.userId });

  const row = rows[0];
  if (!row) return null;

  const live = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, row.userId), isNull(users.deletedAt)))
    .limit(1);

  return live[0] ? { userId: row.userId } : null;
}

export async function deleteTokensFor(
  db: Executor,
  userId: string,
): Promise<void> {
  await db.delete(emailTokens).where(eq(emailTokens.userId, userId));
}

/** Housekeeping for the retention policy, alongside expired sessions. */
export async function purgeExpiredEmailTokens(db: Database): Promise<void> {
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, new Date()));
}
