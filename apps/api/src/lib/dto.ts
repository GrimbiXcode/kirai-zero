import type {
  CurrentUser,
  ItemDto,
  PreferenceDto,
  PublicUser,
  SharedPreferenceDto,
} from "shared";
import type { ItemRow, PreferenceRow } from "../db/schema";
import type { AuthenticatedUser } from "./sessions";

/** Everything a friend may see about a user. Notably: no email address. */
export function toPublicUser(row: {
  id: string;
  handle: string;
  displayName: string;
}): PublicUser {
  return { id: row.id, handle: row.handle, displayName: row.displayName };
}

export function toCurrentUser(user: AuthenticatedUser): CurrentUser {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    email: user.email,
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toItemDto(row: ItemRow | Omit<ItemRow, "createdBy" | "createdAt">): ItemDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    isCurated: row.isCurated,
  };
}

type PreferenceWithItem = Pick<
  PreferenceRow,
  | "id"
  | "stance"
  | "reason"
  | "note"
  | "visibility"
  | "consentedAt"
  | "consentVersion"
  | "updatedAt"
> & { item: ItemDto };

export function toPreferenceDto(row: PreferenceWithItem): PreferenceDto {
  return {
    id: row.id,
    item: row.item,
    stance: row.stance,
    reason: row.reason,
    note: row.note,
    visibility: row.visibility,
    consentedAt: row.consentedAt?.toISOString() ?? null,
    consentVersion: row.consentVersion,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Drops `visibility` and the consent record — a viewer has no business
 *  knowing how the owner classified the entry or when they agreed to store
 *  it, only that they were allowed to see it. */
export function toSharedPreferenceDto(
  row: PreferenceWithItem,
): SharedPreferenceDto {
  const {
    visibility: _visibility,
    consentedAt: _consentedAt,
    consentVersion: _consentVersion,
    ...rest
  } = toPreferenceDto(row);
  return rest;
}
