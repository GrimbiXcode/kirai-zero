import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "ein sicheres passwort";

async function register(page: Page, handle: string, displayName: string) {
  await page.goto("/registrieren");
  await page.getByLabel("Anzeigename").fill(displayName);
  await page.getByLabel("Benutzername").fill(handle);
  await page.getByLabel("E-Mail").fill(`${handle}@example.org`);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Meine Listen" })).toBeVisible();
}

async function addPreference(
  page: Page,
  search: string,
  itemName: string,
  stance: string,
  options: { visibility?: string } = {},
) {
  await page.getByLabel("Etwas eintragen").fill(search);
  await page.getByRole("button", { name: new RegExp(itemName) }).first().click();

  const dialog = page.getByRole("dialog", { name: itemName });
  await dialog.getByRole("button", { name: stance, exact: true }).click();
  if (options.visibility) {
    await dialog.getByRole("button", { name: options.visibility }).click();
  }
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden();
}

async function logout(page: Page) {
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
}

async function login(page: Page, handle: string) {
  await page.getByLabel("E-Mail").fill(`${handle}@example.org`);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Meine Listen" })).toBeVisible();
}

/** Same flow as addPreference, but inside a person's notes block, which has no
 *  visibility control. */
async function addNote(
  page: Page,
  search: string,
  itemName: string,
  stance: string,
) {
  await page.getByLabel("Etwas eintragen").fill(search);
  await page.getByRole("button", { name: new RegExp(itemName) }).first().click();
  const dialog = page.getByRole("dialog", { name: itemName });
  await dialog.getByRole("button", { name: stance, exact: true }).click();
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden();
}

test("two people become friends and see each other's lists", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const annaHandle = `anna${suffix}`;
  const benHandle = `ben${suffix}`;

  // --- Anna signs up and fills her lists ---
  await register(page, annaHandle, "Anna");

  await addPreference(page, "Koriander", "Koriander", "Mag ich nicht");
  await addPreference(page, "Bücher", "Bücher", "Liebe ich");
  await addPreference(page, "Erdnüsse", "Erdnüsse", "Mag ich nicht");
  await addPreference(page, "Lakritz", "Lakritz", "Mag ich nicht", {
    visibility: "Nur für mich",
  });

  await expect(
    page.getByRole("region", { name: "Mag ich" }).getByText("Bücher"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Mag ich nicht" }).getByText("Koriander"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();

  // --- Ben signs up and sends a friend request ---
  await register(page, benHandle, "Ben");
  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByPlaceholder("Benutzername").fill(annaHandle);
  await page.getByRole("button", { name: "Suchen" }).click();
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Anfrage gesendet")).toBeVisible();

  // Before Anna accepts, her profile must stay closed to him: the request is
  // listed as outgoing, and there is no way through to her lists.
  await page.goto("/freunde");
  await expect(
    page
      .getByRole("region", { name: "Deine Anfragen" })
      .getByText("Anna", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Profil ansehen" })).toHaveCount(0);

  await page.getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();

  // --- Anna accepts ---
  await page.getByRole("heading", { name: "Anmelden" }).waitFor();
  await page.getByLabel("E-Mail").fill(`${annaHandle}@example.org`);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByRole("button", { name: "Annehmen" }).click();
  await expect(page.getByText(`@${benHandle}`)).toBeVisible();

  await page.getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();

  // --- Ben opens Anna's profile ---
  await page.getByRole("heading", { name: "Anmelden" }).waitFor();
  await page.getByLabel("E-Mail").fill(`${benHandle}@example.org`);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByRole("link", { name: "Profil ansehen" }).click();

  await expect(
    page.getByRole("region", { name: "Mag Anna", exact: true }).getByText("Bücher"),
  ).toBeVisible();

  const dislikes = page.getByRole("region", { name: "Mag Anna nicht" });
  await expect(dislikes.getByText("Koriander")).toBeVisible();
  // Alphabetical, with nothing outranking anything else.
  await expect(dislikes.getByRole("listitem").first()).toContainText("Erdnüsse");
  // The entry Anna kept private never reaches him.
  await expect(dislikes.getByText("Lakritz")).toHaveCount(0);

  // --- Ending the friendship takes the access away again ---
  await page.getByRole("link", { name: "Zurück" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Freundschaft beenden" }).click();
  await expect(page.getByRole("link", { name: "Profil ansehen" })).toHaveCount(0);
});

test("a member can export their data and delete their account", async ({
  page,
}) => {
  const handle = `carla${Date.now().toString(36)}`;
  await register(page, handle, "Carla");
  await addPreference(page, "Koriander", "Koriander", "Mag ich nicht");

  await page.getByRole("link", { name: "Einstellungen" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Daten herunterladen" }).click();
  expect((await download).suggestedFilename()).toBe("kirai-zero-export.json");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Konto löschen" }).click();

  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();

  // The account is really gone, not just signed out.
  await page.getByLabel("E-Mail").fill(`${handle}@example.org`);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("a new account is reminded to confirm, and a forgotten password has a way back", async ({
  page,
}) => {
  const handle = `dora${Date.now().toString(36)}`;
  await register(page, handle, "Dora");

  // A reminder, never a barrier: the account works while it sits there.
  await expect(
    page.getByText(/E-Mail-Adresse ist noch nicht bestätigt/),
  ).toBeVisible();
  await addPreference(page, "Koriander", "Koriander", "Mag ich nicht");
  await expect(
    page.getByRole("region", { name: "Mag ich nicht" }).getByText("Koriander"),
  ).toBeVisible();

  await logout(page);

  // The confirmation must read the same for a registered address and an
  // unknown one — otherwise the form tells strangers who has an account here.
  const answers: (string | null)[] = [];
  for (const address of [`${handle}@example.org`, "niemand@example.org"]) {
    await page.goto("/passwort-vergessen");
    await page.getByLabel("E-Mail").fill(address);
    await page.getByRole("button", { name: "Link anfordern" }).click();
    const notice = page.getByRole("status");
    await expect(notice).toBeVisible();
    answers.push(await notice.textContent());
  }
  expect(answers[0]).toBe(answers[1]);

  // A link that lost its token says so instead of showing an empty form.
  await page.goto("/passwort-neu");
  await expect(page.getByRole("alert")).toContainText("unvollständig");
  await expect(page.getByLabel("Neues Passwort")).toHaveCount(0);
});

test("a private profile can be linked and then shows what holds up", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const annaHandle = `panna${suffix}`;
  const benHandle = `pben${suffix}`;

  // --- Ben records his own preferences ---
  await register(page, benHandle, "Ben");
  await addPreference(page, "Koriander", "Koriander", "Mag ich nicht");
  await addPreference(page, "Bücher", "Bücher", "Mag ich nicht");
  await addPreference(page, "Lakritz", "Lakritz", "Mag ich nicht", {
    visibility: "Nur für mich",
  });
  await logout(page);

  // --- Anna keeps a private profile about Ben before he is even a friend ---
  await register(page, annaHandle, "Anna");
  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByPlaceholder("z.B. Oma Trudi").fill("Ben vom Kurs");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.getByRole("link", { name: "Person öffnen" }).click();

  await addNote(page, "Koriander", "Koriander", "Mag ich nicht");
  await addNote(page, "Bücher", "Bücher", "Liebe ich");
  await addNote(page, "Lakritz", "Lakritz", "Mag ich nicht");

  // Nothing to compare against yet, so no badge may show. Exact matches: the
  // surrounding hints legitimately contain the word "bestätigt".
  await expect(page.getByText("Bestätigt", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Unbestätigt", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/bestätigte Freundschaft/)).toBeVisible();

  // --- They become friends, then Anna links the profile ---
  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByPlaceholder("Benutzername").fill(benHandle);
  await page.getByRole("button", { name: "Suchen" }).click();
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Anfrage gesendet")).toBeVisible();
  await logout(page);

  await login(page, benHandle);
  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByRole("button", { name: "Annehmen" }).click();
  await expect(page.getByText(`@${annaHandle}`)).toBeVisible();
  await logout(page);

  await login(page, annaHandle);
  await page.getByRole("link", { name: "Freunde" }).click();
  await page.getByRole("link", { name: "Person öffnen" }).click();
  await page.getByLabel(/Mit einem Freund verknüpfen/).selectOption(benHandle);
  await page.getByRole("button", { name: "Verknüpfen" }).click();
  await expect(page.getByText(`Verknüpft mit @${benHandle}`)).toBeVisible();

  const koriander = page.getByText("Koriander").locator("xpath=ancestor::li[1]");
  const buecher = page.getByText("Bücher").locator("xpath=ancestor::li[1]");
  const lakritz = page.getByText("Lakritz").locator("xpath=ancestor::li[1]");

  await expect(koriander.getByText("Bestätigt", { exact: true })).toBeVisible();
  await expect(buecher.getByText("Widerspricht")).toBeVisible();
  // Ben keeps his liquorice to himself, so the guess must stay unconfirmed —
  // linking may not reveal what the profile would not.
  await expect(lakritz.getByText("Unbestätigt", { exact: true })).toBeVisible();
});
