import { test, expect } from "@playwright/test";
test("formateur et stagiaire : session, chat, fichiers et responsive", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Mot de passe administrateur")
    .fill("e2e-only-password");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await expect(
    page.getByRole("heading", { name: "Créer une session" }),
  ).toBeVisible();
  await page.getByLabel("Votre nom dans les échanges").fill("Jean-Louis");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByLabel("Titre de la session").fill("Atelier Excel");
  const tomorrow = new Date(Date.now() + 86400000);
  const local = new Date(
    tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Tout effacer le").fill(local);
  await page.getByLabel("Code d'accès").fill("bonjour");
  await page
    .getByRole("button", { name: "Créer et ouvrir la session" })
    .click();
  await expect(page.getByLabel("Votre message")).toBeVisible();
  const url = page.url();
  const context = await browser.newContext({ timezoneId: "Europe/Paris" });
  const guest = await context.newPage();
  await guest.goto(url);
  await guest.getByLabel("Votre pseudo").fill("Alice");
  await guest.getByLabel("Code d'accès").fill("bonjour");
  await guest.getByRole("button", { name: "Rejoindre la session" }).click();
  await guest.getByLabel("Votre message").fill("Bonjour le groupe !");
  await guest.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(
    page.getByText("Bonjour le groupe !", { exact: true }),
  ).toBeVisible();
  await guest.reload();
  await expect(guest.getByLabel("Votre message")).toBeVisible();
  await guest.getByLabel("Choisir des fichiers").setInputFiles({
    name: "exercice.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("contenu de test"),
  });
  await expect(
    page.locator(".file-list").getByText("exercice.zip"),
  ).toBeVisible();
  await expect(
    page.locator(".message-meta").getByText("Alice", { exact: true }).first(),
  ).toBeVisible();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto(url);
  await other.getByLabel("Votre pseudo").fill("alice");
  await other.getByLabel("Code d'accès").fill("bonjour");
  await other.getByRole("button", { name: "Rejoindre la session" }).click();
  await expect(other.getByRole("alert")).toContainText("déjà utilisé");
  await guest.getByRole("button", { name: "Modifier", exact: true }).click();
  await guest.getByLabel("Modifier le message").fill("Message corrigé");
  await guest.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByText("Message corrigé", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.locator(".file-list a").click();
  expect((await downloadPromise).suggestedFilename()).toBe("exercice.zip");
  await guest.setViewportSize({ width: 390, height: 844 });
  await expect(guest.getByLabel("Votre message")).toBeVisible();
  expect(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/session-desktop.png",
    fullPage: true,
  });
  await guest.screenshot({
    path: "test-results/session-mobile.png",
    fullPage: true,
  });
  await context.close();
  await otherContext.close();
});
