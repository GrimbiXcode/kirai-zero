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
  options: { reason?: string; visibility?: string } = {},
) {
  await page.getByLabel("Etwas eintragen").fill(search);
  await page.getByRole("button", { name: new RegExp(itemName) }).first().click();

  const dialog = page.getByRole("dialog", { name: itemName });
  await dialog.getByRole("button", { name: stance, exact: true }).click();
  if (options.reason) {
    await dialog.getByRole("button", { name: options.reason }).click();
  }
  if (options.visibility) {
    await dialog.getByRole("button", { name: options.visibility }).click();
  }
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

  await addPreference(page, "Koriander", "Koriander", "Gar nicht");
  await addPreference(page, "Bücher", "Bücher", "Liebe ich");
  await addPreference(page, "Erdnüsse", "Erdnüsse", "Gar nicht", {
    reason: "Allergie",
  });
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
  // The allergy is flagged and leads the list.
  await expect(dislikes.getByText("Allergie")).toBeVisible();
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
  await addPreference(page, "Koriander", "Koriander", "Gar nicht");

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
