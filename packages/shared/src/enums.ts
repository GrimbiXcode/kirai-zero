/**
 * Vocabularies shared by API and clients. Kept as const tuples so they can be
 * fed to both Drizzle's pgEnum and Zod without duplicating the values.
 */

export const ITEM_KINDS = [
  "food",
  "ingredient",
  "drink",
  "gift",
  "material",
  "scent",
  "activity",
  "other",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * How someone feels about a thing. `dislike` carries a single, stated meaning:
 * served or gifted this, I will not eat it and it will be thrown away. Why that
 * is — taste, health, conviction — is nobody's business but the person's own,
 * and the app deliberately does not ask.
 */
export const STANCES = ["love", "like", "neutral", "dislike"] as const;
export type Stance = (typeof STANCES)[number];

export const VISIBILITIES = ["friends", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const FRIEND_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
] as const;
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUSES)[number];

/**
 * What a token mailed to someone's address entitles them to do. One vocabulary
 * for both, because they share a lifetime, a hashing scheme and a purge job —
 * the purpose only decides how long the token lives and which route accepts it.
 */
export const EMAIL_TOKEN_PURPOSES = ["verify_email", "password_reset"] as const;
export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

export function isPositive(stance: Stance): boolean {
  return stance === "love" || stance === "like";
}

export function isNegative(stance: Stance): boolean {
  return stance === "dislike";
}

/**
 * How a private note about someone holds up against what that person has
 * recorded themselves. Only meaningful for a person profile linked to an
 * account — an unlinked one has nothing to compare against.
 */
export const ASSERTION_STATUSES = [
  "confirmed",
  "contradicted",
  "unconfirmed",
] as const;
export type AssertionStatus = (typeof ASSERTION_STATUSES)[number];

/**
 * Compares a guess with what the person says, by direction rather than by
 * exact value: guessing "love" where they said "like" is agreement, not a
 * contradiction. `theirs` is null when the person has no entry for the item —
 * or has one they keep private, which must look exactly the same from here.
 */
export function compareStance(
  mine: Stance,
  theirs: Stance | null,
): AssertionStatus {
  if (theirs === null) return "unconfirmed";
  const direction = (stance: Stance) =>
    isPositive(stance) ? 1 : isNegative(stance) ? -1 : 0;
  return direction(mine) === direction(theirs) ? "confirmed" : "contradicted";
}
