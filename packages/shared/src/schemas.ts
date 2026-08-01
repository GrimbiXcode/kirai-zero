import { z } from "zod";
import {
  ASSERTION_STATUSES,
  ITEM_KINDS,
  STANCES,
  VISIBILITIES,
  FRIEND_REQUEST_STATUSES,
} from "./enums";
import { normalizeEmail, normalizeHandle } from "./slug";

export const itemKindSchema = z.enum(ITEM_KINDS);
export const stanceSchema = z.enum(STANCES);
export const visibilitySchema = z.enum(VISIBILITIES);
export const friendRequestStatusSchema = z.enum(FRIEND_REQUEST_STATUSES);
export const assertionStatusSchema = z.enum(ASSERTION_STATUSES);

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
  note: z.string().trim().max(280).optional(),
  visibility: visibilitySchema.default("friends"),
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

const displayNameSchema = z.string().trim().min(1).max(60);

export const personCreateSchema = z.object({
  displayName: displayNameSchema,
  note: z.string().trim().max(280).optional(),
});
export type PersonCreateInput = z.infer<typeof personCreateSchema>;

export const personUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    note: z.string().trim().max(280).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "empty_update");
export type PersonUpdateInput = z.infer<typeof personUpdateSchema>;

/** A note about a person carries no visibility: it is private by construction,
 *  there is nobody it could be shared with. */
export const personEntryUpsertSchema = z.object({
  stance: stanceSchema,
  note: z.string().trim().max(280).optional(),
});
export type PersonEntryUpsertInput = z.infer<typeof personEntryUpsertSchema>;

export const personLinkSchema = z.object({ handle: handleSchema });
export type PersonLinkInput = z.infer<typeof personLinkSchema>;

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
  note: string | null;
  visibility: (typeof VISIBILITIES)[number];
  updatedAt: string;
}

/** A friend's preference as seen by someone else: no visibility field, since
 *  private entries are filtered server-side and never reach the client. */
export type SharedPreferenceDto = Omit<PreferenceDto, "visibility">;

/**
 * One thing a user believes about someone else. `status` is present only when
 * the person profile is linked to an account — there is nothing to compare an
 * unlinked profile against.
 */
export interface PersonEntryDto {
  id: string;
  item: ItemDto;
  stance: (typeof STANCES)[number];
  note: string | null;
  status: (typeof ASSERTION_STATUSES)[number] | null;
  updatedAt: string;
}

export interface PersonDto {
  id: string;
  displayName: string;
  note: string | null;
  /** The friend this profile stands for, or null while it is just a name. */
  linkedUser: PublicUser | null;
  entryCount: number;
  createdAt: string;
}

export interface PersonDetailDto extends PersonDto {
  entries: PersonEntryDto[];
}

export interface FriendProfileDto {
  user: PublicUser;
  friendsSince: string;
  likes: SharedPreferenceDto[];
  dislikes: SharedPreferenceDto[];
  /** What the viewer privately believes about this friend. Kept apart from
   *  their own entries so a guess never reads as a fact. */
  myNotes: PersonEntryDto[];
  /** Container holding those notes; null until the viewer writes the first. */
  personId: string | null;
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
