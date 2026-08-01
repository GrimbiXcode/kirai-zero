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

export const STANCES = ["love", "like", "neutral", "dislike", "avoid"] as const;
export type Stance = (typeof STANCES)[number];

/**
 * Why someone holds a stance. Deliberately separate from the stance itself:
 * "does not like it" and "cannot eat it" look the same in a list but mean very
 * different things to a host planning a meal.
 */
export const REASONS = [
  "taste",
  "allergy",
  "intolerance",
  "ethical",
  "religious",
  "other",
] as const;
export type Reason = (typeof REASONS)[number];

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
  return stance === "dislike" || stance === "avoid";
}

/**
 * Health-driven reasons are non-negotiable for a host, unlike a matter of
 * taste. Callers use this to sort and highlight them separately.
 *
 * Deliberately narrower than `isSpecialCategory`: this is about danger at the
 * dinner table, not about data protection law.
 */
export function isHealthCritical(reason: Reason): boolean {
  return reason === "allergy" || reason === "intolerance";
}

/**
 * Reasons that put an entry into a special category under Art. 9(1) GDPR
 * (and Art. 5 lit. c revDSG): allergies and intolerances are health data,
 * religious and ethical motives reveal religious or philosophical beliefs.
 *
 * Storing any of these needs the explicit consent of the person — regardless
 * of visibility, because Art. 9 restricts the processing itself and not only
 * the disclosure to friends.
 */
export function isSpecialCategory(reason: Reason): boolean {
  return (
    reason === "allergy" ||
    reason === "intolerance" ||
    reason === "religious" ||
    reason === "ethical"
  );
}

/**
 * Identifies the wording someone consented to. Stored alongside the consent so
 * that a later change to the text does not silently reinterpret consent that
 * was given for an earlier version. Bump this whenever the consent text in the
 * client changes in substance.
 */
export const CONSENT_VERSION = "art9-2026-08";
