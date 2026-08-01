/**
 * Normalises a free-text item name into a stable key used to deduplicate the
 * shared item catalogue. Two users typing "Koriander" and " koriander " must
 * end up on the same item, otherwise aggregating preferences across guests
 * silently misses entries.
 *
 * German umlauts are transliterated before diacritics are stripped, so "Öl"
 * becomes "oel" rather than "ol".
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    // Compose first: a decomposed "a + combining diaeresis" must still be seen
    // as "ä" by the transliteration below, not lose its mark to the NFD strip.
    .normalize("NFC")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Handles are case-insensitive and are stored lowercased. */
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
