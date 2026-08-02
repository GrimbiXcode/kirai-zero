import { and, asc, eq, inArray } from "drizzle-orm";
import { compareStance, type PersonEntryDto, type Stance } from "shared";
import type { Database } from "../db/client";
import {
  items,
  personEntries,
  persons,
  preferences,
  type PersonRow,
} from "../db/schema";
import { toItemDto } from "./dto";
import { notFound } from "./errors";
import { areFriends } from "./friendship";

/**
 * The single gate in front of a person profile. Answers 404 for a profile that
 * belongs to someone else — these are private notes, and confirming that a
 * given id exists would already say more than the owner agreed to.
 */
export async function requirePerson(
  db: Database,
  viewerId: string,
  personId: string,
): Promise<PersonRow> {
  const rows = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.ownerId, viewerId)))
    .limit(1);
  const person = rows[0];
  if (!person) throw notFound("person_not_found", "No such person");
  return person;
}

const entryColumns = {
  id: personEntries.id,
  stance: personEntries.stance,
  note: personEntries.note,
  updatedAt: personEntries.updatedAt,
  item: {
    id: items.id,
    slug: items.slug,
    name: items.name,
    kind: items.kind,
    isCurated: items.isCurated,
  },
};

/**
 * Loads the owner's notes and, where the profile stands for an account,
 * decides how each one holds up against what that person recorded themselves.
 *
 * The comparison runs only between friends and only over entries the friend
 * made visible to friends. An entry they keep private is indistinguishable
 * from one they never made — linking a profile must not reveal anything the
 * friend's profile page would not.
 */
export async function loadPersonEntries(
  db: Database,
  person: Pick<PersonRow, "id" | "ownerId" | "linkedUserId">,
): Promise<PersonEntryDto[]> {
  const rows = await db
    .select(entryColumns)
    .from(personEntries)
    .innerJoin(items, eq(items.id, personEntries.itemId))
    .where(eq(personEntries.personId, person.id))
    .orderBy(asc(items.name));

  if (rows.length === 0) return [];

  const theirStances = person.linkedUserId
    ? await loadVisibleStances(
        db,
        person.ownerId,
        person.linkedUserId,
        rows.map((row) => row.item.id),
      )
    : null;

  return rows.map((row) => ({
    id: row.id,
    item: toItemDto(row.item),
    stance: row.stance,
    note: row.note,
    // Null rather than "unconfirmed" while unlinked: there is nothing to
    // compare against, and claiming otherwise would be noise.
    status: theirStances
      ? compareStance(row.stance, theirStances.get(row.item.id) ?? null)
      : null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function loadVisibleStances(
  db: Database,
  viewerId: string,
  ownerOfListId: string,
  itemIds: string[],
): Promise<Map<string, Stance>> {
  if (!(await areFriends(db, viewerId, ownerOfListId))) return new Map();

  const rows = await db
    .select({ itemId: preferences.itemId, stance: preferences.stance })
    .from(preferences)
    .where(
      and(
        eq(preferences.userId, ownerOfListId),
        eq(preferences.visibility, "friends"),
        inArray(preferences.itemId, itemIds),
      ),
    );
  return new Map(rows.map((row) => [row.itemId, row.stance]));
}
