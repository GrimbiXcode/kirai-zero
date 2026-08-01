import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  FRIEND_REQUEST_STATUSES,
  ITEM_KINDS,
  STANCES,
  VISIBILITIES,
} from "shared";

export const itemKindEnum = pgEnum("item_kind", ITEM_KINDS);
export const stanceEnum = pgEnum("stance", STANCES);
export const visibilityEnum = pgEnum("visibility", VISIBILITIES);
export const friendRequestStatusEnum = pgEnum(
  "friend_request_status",
  FRIEND_REQUEST_STATUSES,
);

/**
 * Only what the product genuinely needs: no phone number, no address, no date
 * of birth. Adding a column here means adding an entry to the processing
 * record in docs/privacy-concept.md.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    locale: text("locale").notNull().default("de"),
    /**
     * Set when someone deletes their account. The row survives only until the
     * next housekeeping run erases it; identifying fields are already
     * overwritten and everything others could see is gone by then.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_key").on(table.email),
    uniqueIndex("users_handle_key").on(table.handle),
    index("users_deleted_at_idx").on(table.deletedAt),
  ],
);

/**
 * Session records carry no IP address and no user agent on purpose — they are
 * not needed to run the product, and not collecting them is cheaper than
 * justifying and expiring them.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_key").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

/**
 * A shared catalogue rather than free text per user: aggregating "which
 * ingredient does nobody at this table want" only works if two people who both
 * typed "Koriander" point at the same row.
 *
 * `createdBy` is nulled out when that user deletes their account, so other
 * people's preferences survive the deletion.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: itemKindEnum("kind").notNull(),
    isCurated: boolean("is_curated").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Scoped to kind so "Schokolade" can exist both as food and as a gift idea.
    uniqueIndex("items_kind_slug_key").on(table.kind, table.slug),
    index("items_slug_idx").on(table.slug),
  ],
);

export const preferences = pgTable(
  "preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    stance: stanceEnum("stance").notNull(),
    note: text("note"),
    visibility: visibilityEnum("visibility").notNull().default("friends"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("preferences_user_item_key").on(table.userId, table.itemId),
    index("preferences_user_id_idx").on(table.userId),
  ],
);

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("friend_requests_to_user_idx").on(table.toUserId, table.status),
    index("friend_requests_from_user_idx").on(table.fromUserId, table.status),
  ],
);

/**
 * One row per friendship with the two ids sorted, so a pair can never be stored
 * twice in opposite order. Callers must go through `orderedPair()`.
 */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("friendships_pair_key").on(table.userAId, table.userBId),
    index("friendships_user_b_idx").on(table.userBId),
  ],
);

/**
 * A private profile one user keeps about someone else — a grandmother who is
 * not in the app, or a friend they want to jot guesses about. Visible to the
 * owner and to nobody else, ever.
 *
 * `linkedUserId` turns it into "these are my notes about that account". It is
 * nulled when the friendship ends or the account is deleted, which leaves the
 * owner their notes without keeping an identified link to a person they are no
 * longer connected to.
 */
export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    note: text("note"),
    linkedUserId: uuid("linked_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("persons_owner_idx").on(table.ownerId),
    // At most one profile per (owner, linked account) — partial, because any
    // number of unlinked profiles may of course exist side by side.
    uniqueIndex("persons_owner_linked_key")
      .on(table.ownerId, table.linkedUserId)
      .where(sql`${table.linkedUserId} is not null`),
  ],
);

/**
 * What the owner believes about that person. No `visibility` column on
 * purpose: these are private by construction, there is nobody they could be
 * shared with.
 */
export const personEntries = pgTable(
  "person_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    stance: stanceEnum("stance").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("person_entries_person_item_key").on(
      table.personId,
      table.itemId,
    ),
    index("person_entries_person_idx").on(table.personId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type PersonRow = typeof persons.$inferSelect;
export type PersonEntryRow = typeof personEntries.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type PreferenceRow = typeof preferences.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type FriendRequestRow = typeof friendRequests.$inferSelect;
export type FriendshipRow = typeof friendships.$inferSelect;
