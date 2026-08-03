import type { Mail } from "./transport";

/**
 * The three mails the app sends. German, informal, no marketing — the same
 * register as the restore notice in docs/privacy-concept.md, and the same
 * spelling convention as the UI: "ss", never "ß".
 *
 * Each function returns the finished message so the routes stay about routing
 * and the wording can be read in one place.
 */

const SIGNATURE = "kirai-zero";

function compose(lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

export function verifyEmailMail(input: {
  to: string;
  displayName: string;
  url: string;
  ttlDays: number;
}): Mail {
  return {
    to: input.to,
    subject: "Bestätige deine E-Mail-Adresse",
    text: compose([
      `Hallo ${input.displayName}`,
      "",
      "schön, dass du dabei bist. Bitte bestätige mit diesem Link, dass diese",
      "Adresse dir gehört:",
      "",
      input.url,
      "",
      `Der Link gilt ${input.ttlDays} Tage. Bis dahin und danach kannst du`,
      "kirai-zero ganz normal nutzen — die Bestätigung stellt nur sicher, dass",
      "wir dich erreichen, wenn du einmal dein Passwort vergisst.",
      "",
      "Hast du dich nicht registriert, ignoriere diese Mail einfach. Ohne",
      "Bestätigung passiert mit dieser Adresse nichts weiter.",
      "",
      SIGNATURE,
    ]),
  };
}

export function passwordResetMail(input: {
  to: string;
  displayName: string;
  url: string;
  ttlMinutes: number;
}): Mail {
  return {
    to: input.to,
    subject: "Passwort zurücksetzen",
    text: compose([
      `Hallo ${input.displayName}`,
      "",
      "mit diesem Link kannst du ein neues Passwort setzen:",
      "",
      input.url,
      "",
      `Der Link gilt ${input.ttlMinutes} Minuten und lässt sich nur einmal`,
      "verwenden. Forderst du in der Zwischenzeit einen neuen an, wird dieser",
      "hier ungültig.",
      "",
      "Warst du das nicht, musst du nichts tun: solange der Link nicht geöffnet",
      "wird, bleibt dein Passwort unverändert.",
      "",
      SIGNATURE,
    ]),
  };
}

/**
 * Carries no link and no token — it is a notice, not an action. Anyone who did
 * not trigger the reset has already lost the account by the time this arrives,
 * so the one useful thing it can offer is where to turn.
 */
export function passwordChangedMail(input: {
  to: string;
  displayName: string;
  supportEmail?: string;
}): Mail {
  const help = input.supportEmail
    ? `Warst du das nicht, melde dich bitte umgehend bei ${input.supportEmail}.`
    : "Warst du das nicht, melde dich bitte umgehend bei uns.";

  return {
    to: input.to,
    subject: "Dein Passwort wurde geändert",
    text: compose([
      `Hallo ${input.displayName}`,
      "",
      "dein Passwort bei kirai-zero wurde soeben zurückgesetzt. Alle Geräte,",
      "die angemeldet waren, wurden dabei abgemeldet — auf jedem musst du dich",
      "einmal neu anmelden.",
      "",
      help,
      "",
      SIGNATURE,
    ]),
  };
}
