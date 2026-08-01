import { z } from "zod";
import {
  ITEM_KINDS,
  REASONS,
  STANCES,
  VISIBILITIES,
  FRIEND_REQUEST_STATUSES,
} from "./enums";
import { normalizeEmail, normalizeHandle } from "./slug";

export const itemKindSchema = z.enum(ITEM_KINDS);
export const stanceSchema = z.enum(STANCES);
export const reasonSchema = z.enum(REASONS);
export const visibilitySchema = z.enum(VISIBILITIES);
export const friendRequestStatusSchema = z.enum(FRIEND_REQUEST_STATUSES);

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform(normalizeEmail);

/**
 * The handle is the only identifier other users can search by, so it is
 * deliberately narrow: lowercase, no lookalike punctuation runs, no spaces.
 */
const handleSchema = z
  .string()
  .trim()
  .transform(normalizeHandle)
  .pipe(
    z
      .string()
      .min(3, "handle_too_short")
      .max(30, "handle_too_long")
      .regex(/^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/, "handle_invalid"),
  );

const passwordSchema = z
  .string()
  .min(10, "password_too_short")
  .max(200, "password_too_long");

export const registerSchema = z.object({
  email: emailSchema,
  handle: handleSchema,
  displayName: z.string().trim().min(1).max(60),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const itemSearchQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  kind: itemKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ItemSearchQuery = z.infer<typeof itemSearchQuerySchema>;

export const itemCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: itemKindSchema,
});
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;

export const preferenceUpsertSchema = z.object({
  stance: stanceSchema,
  reason: reasonSchema.default("taste"),
  note: z.string().trim().max(280).optional(),
  visibility: visibilitySchema.default("friends"),
  /**
   * Must be true when `reason` is a special category under Art. 9(1) GDPR.
   * The dependency between the two fields is checked in the route rather than
   * here, so the API can answer with its own `consent_required` code instead
   * of a generic validation failure.
   */
  consentGiven: z.boolean().optional(),
});
export type PreferenceUpsertInput = z.infer<typeof preferenceUpsertSchema>;

export const userSearchQuerySchema = z.object({
  handle: z.string().trim().toLowerCase().min(2).max(30),
});
export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;

export const friendRequestCreateSchema = z.object({
  handle: handleSchema,
});
export type FriendRequestCreateInput = z.infer<
  typeof friendRequestCreateSchema
>;

export const uuidParamSchema = z.object({ id: z.uuid() });
export const itemIdParamSchema = z.object({ itemId: z.uuid() });
export const userIdParamSchema = z.object({ userId: z.uuid() });

// --- Response shapes -------------------------------------------------------
// Declared as types rather than schemas: the API is the only producer, and the
// client gains nothing from re-validating its own server's payloads.

export interface PublicUser {
  id: string;
  handle: string;
  displayName: string;
}

export interface CurrentUser extends PublicUser {
  email: string;
  locale: string;
  createdAt: string;
}

export interface ItemDto {
  id: string;
  slug: string;
  name: string;
  kind: (typeof ITEM_KINDS)[number];
  isCurated: boolean;
}

export interface PreferenceDto {
  id: string;
  item: ItemDto;
  stance: (typeof STANCES)[number];
  reason: (typeof REASONS)[number];
  note: string | null;
  visibility: (typeof VISIBILITIES)[number];
  /** Set only for special-category reasons; part of the data export so the
   *  person can see what they consented to and when. */
  consentedAt: string | null;
  consentVersion: string | null;
  updatedAt: string;
}

/**
 * A friend's preference as seen by someone else. Drops the visibility field,
 * since private entries are filtered server-side and never reach the client,
 * and the consent record, which is bookkeeping between the owner and us.
 */
export type SharedPreferenceDto = Omit<
  PreferenceDto,
  "visibility" | "consentedAt" | "consentVersion"
>;

export interface FriendProfileDto {
  user: PublicUser;
  friendsSince: string;
  likes: SharedPreferenceDto[];
  dislikes: SharedPreferenceDto[];
}

export interface FriendRequestDto {
  id: string;
  direction: "incoming" | "outgoing";
  user: PublicUser;
  status: (typeof FRIEND_REQUEST_STATUSES)[number];
  createdAt: string;
}

export interface FriendDto {
  user: PublicUser;
  friendsSince: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
