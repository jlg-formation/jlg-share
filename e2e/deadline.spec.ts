import { test, expect } from "@playwright/test";

test("relative deadline keyboard navigation, cancel, exact fallback and mobile themes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Mot de passe administrateur")
    .fill("e2e-only-password");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  const day = page.getByRole("radio", { name: "Dans 24 h", exact: true });
  await expect(day).toBeChecked();
  await day.focus();
  await day.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Ce soir à minuit" }),
  ).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Demain à minuit" }),
  ).toBeChecked();
  await expect(page.locator(".deadline-preview")).toContainText(
    "demain à minuit — dans",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Choisir une date précise" }),
  ).toBeFocused();
  await day.check();
  await page.getByLabel("Titre de la session").fill("Durée UX");
  await page
    .getByRole("button", { name: "Créer et ouvrir la session" })
    .click();
  await expect(page.getByLabel("Votre message")).toBeVisible();
  const path = "/api/sessions/" + new URL(page.url()).pathname.slice(1);
  const before = await (await page.request.get(path)).json();
  expect(before.expiresAt - Date.now()).toBeGreaterThan(86_300_000);
  await expect(page.getByText(/Tout sera effacé/)).toHaveCount(0);
  await expect(page.locator(".topbar .participant-count")).toHaveText(
    "1 participant",
  );
  await page.getByRole("button", { name: "Gérer la session" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Temps restant :/)).toBeVisible();
  await dialog.getByRole("button", { name: "Modifier", exact: true }).click();
  // Opening the controls and fallback alone must preserve milliseconds exactly.
  await dialog
    .getByRole("button", { name: "Choisir une date précise" })
    .click();
  await expect(dialog.getByLabel(/Date et heure/)).toBeFocused();
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect((await (await page.request.get(path)).json()).expiresAt).toBe(
    before.expiresAt,
  );
  await page.getByRole("button", { name: "Gérer la session" }).click();
  await dialog.getByRole("button", { name: "Modifier", exact: true }).click();
  await dialog.getByRole("radio", { name: "Dans 7 jours" }).check();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  expect((await (await page.request.get(path)).json()).expiresAt).toBe(
    before.expiresAt,
  );
  await page.getByRole("button", { name: "Gérer la session" }).click();
  await dialog.getByRole("button", { name: "Modifier", exact: true }).click();
  await dialog.getByRole("radio", { name: "Autre durée…" }).check();
  const amount = dialog.getByRole("spinbutton", { name: "Dans", exact: true });
  await amount.fill("0");
  await expect(dialog.getByRole("alert")).toContainText("strictement positive");
  await amount.fill("3");
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/deadline-${theme}-${width}.png`,
      });
    }
  }
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const after = await (await page.request.get(path)).json();
  expect(after.expiresAt - Date.now()).toBeGreaterThan(3 * 86_400_000 - 60_000);
});
