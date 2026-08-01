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

export function isPositive(stance: Stance): boolean {
  return stance === "love" || stance === "like";
}

export function isNegative(stance: Stance): boolean {
  return stance === "dislike";
}
