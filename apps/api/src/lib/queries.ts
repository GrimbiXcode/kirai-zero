import { items, preferences } from "../db/schema";

/**
 * Column selection shared by every "preferences joined with their item" read,
 * so the own-list view and a friend's profile can never drift into returning
 * different fields for the same concept.
 */
export const selectPreferenceColumns = {
  id: preferences.id,
  stance: preferences.stance,
  note: preferences.note,
  visibility: preferences.visibility,
  updatedAt: preferences.updatedAt,
  item: {
    id: items.id,
    slug: items.slug,
    name: items.name,
    kind: items.kind,
    isCurated: items.isCurated,
  },
} as const;
