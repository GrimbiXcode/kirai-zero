import de from "./de.json";

/**
 * Deliberately not a translation library. The app has a few hundred flat keys
 * and needs neither a plural engine nor lazy namespaces; a typed dictionary
 * catches a missing or misspelled key at compile time and adds nothing to the
 * bundle. Another language is one more file with the same type.
 */
export type TranslationKey = keyof typeof de;

const dictionaries = { de } satisfies Record<string, Record<TranslationKey, string>>;

export type Locale = keyof typeof dictionaries;

export const DEFAULT_LOCALE: Locale = "de";

let activeLocale: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getLocale(): Locale {
  return activeLocale;
}

/**
 * `t("friends.since", { date })` fills `{date}` in the translated string.
 * Unknown placeholders are left untouched so a missing value is visible during
 * development instead of silently rendering as an empty gap.
 */
export function t(
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const template = dictionaries[activeLocale][key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Guard for keys assembled at runtime, such as `auth.error.${code}` built from
 * an API error code. Without it an unknown code would render as `undefined`.
 */
export function hasTranslation(key: string): key is TranslationKey {
  return Object.hasOwn(dictionaries[activeLocale], key);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(activeLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}
