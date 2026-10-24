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
  const defaultDelay = await page
    .getByLabel("Tout effacer le")
    .evaluate(
      (element) =>
        new Date((element as HTMLInputElement).value).getTime() - Date.now(),
    );
  expect(defaultDelay).toBeGreaterThan(24 * 60 * 60 * 1000 - 120_000);
  expect(defaultDelay).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.now() + 2 * 86400000);
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
  await expect(page).toHaveURL(/\/atelier-excel$/);
  let url = page.url();
  const initialSnapshot =
    "/api/sessions/" + new URL(url).pathname.slice(1) + "/snapshot";
  const beforeExtension = await (
    await page.request.get(initialSnapshot)
  ).json();
  const snapshotPath =
    "/api/sessions/" + beforeExtension.session.id + "/snapshot";
  await page.getByRole("button", { name: "Gérer la session" }).click();
  const deadline = page.getByLabel(/Nouvelle date de suppression/);
  const extendedDate = await deadline.evaluate((element) => {
    const d = new Date(
      new Date((element as HTMLInputElement).value).getTime() + 86400000,
    );
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  await deadline.fill(extendedDate);
  await page.getByLabel("Adresse de la session").fill("excel-avance");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Réglages de la session" }),
  ).not.toBeVisible();
  const afterExtension = await (await page.request.get(snapshotPath)).json();
  expect(afterExtension.session.expiresAt).toBeGreaterThan(
    beforeExtension.session.expiresAt,
  );
  await expect(page).toHaveURL(/\/excel-avance$/);
  url = page.url();
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
  await page.getByRole("button", { name: "Gérer la session" }).click();
  await page.getByLabel("Adresse de la session").fill("excel");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/\/excel$/);
  await expect(guest).toHaveURL(/\/excel$/);
  url = page.url();
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

  await expect(
    page.getByRole("heading", { name: "Atelier Excel", exact: true }),
  ).toHaveCount(1);
  for (let i = 0; i < 25; i++) {
    const response = await page.request.post(
      snapshotPath.replace("/snapshot", "/messages"),
      {
        data: { text: "Message de test " + i + "\nUne autre ligne." },
        headers: { Origin: new URL(url).origin },
      },
    );
    expect(response.status()).toBe(201);
  }
  await expect
    .poll(() =>
      page
        .locator(".messages")
        .evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true);
  for (const viewport of [
    { width: 1280, height: 600 },
    { width: 1024, height: 500 },
    { width: 390, height: 844 },
    { width: 390, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          window.scrollY === 0,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Copier le lien", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("button", { name: "Gérer la session", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel("Votre message")).toBeInViewport({ ratio: 1 });
  }
  await page
    .getByRole("button", { name: "Fichiers & écran", exact: true })
    .click();
  await expect(
    page.locator(".file-list").getByText("exercice.zip"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Partager mon écran", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 1280, height: 720 });
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
