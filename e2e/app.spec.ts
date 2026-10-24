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
  const messageActions = guest.getByRole("button", {
    name: "Actions du message de Alice",
    exact: true,
  });
  await expect(
    guest.getByRole("menuitem", { name: "Modifier", exact: true }),
  ).toBeHidden();
  await messageActions.focus();
  await messageActions.press("ArrowDown");
  await expect(
    guest.getByRole("menuitem", { name: "Copier", exact: true }),
  ).toBeFocused();
  await guest.keyboard.press("ArrowDown");
  await expect(
    guest.getByRole("menuitem", { name: "Modifier", exact: true }),
  ).toBeFocused();
  await guest.keyboard.press("Escape");
  await expect(guest.getByRole("menu")).toBeHidden();
  await expect(messageActions).toBeFocused();
  await messageActions.click();
  await guest.getByRole("menuitem", { name: "Modifier", exact: true }).click();
  await guest.getByLabel("Modifier le message").fill("Message corrigé");
  await guest.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByText("Message corrigé", { exact: true }),
  ).toBeVisible();
  // Le même message appartient à Alice dans son navigateur, et à un autre
  // participant dans celui du formateur.
  await expect(page.locator(".connection")).toHaveCount(0);
  for (const viewer of [page, guest]) {
    for (const width of [1280, 390]) {
      await viewer.setViewportSize({ width, height: 844 });
      const message = viewer
        .locator(".message")
        .filter({ hasText: "Message corrigé" });
      if (viewer === guest) await expect(message).toHaveClass(/own/);
      else await expect(message).not.toHaveClass(/own/);
      const alignment = await message.evaluate((element) => {
        const area = element.parentElement!.getBoundingClientRect();
        const bubble = element.getBoundingClientRect();
        return {
          left: bubble.left - area.left,
          right: area.right - bubble.right,
        };
      });
      if (viewer === guest)
        expect(alignment.left).toBeGreaterThan(alignment.right);
      else expect(alignment.right).toBeGreaterThan(alignment.left);
    }
    await viewer.setViewportSize({ width: 1280, height: 720 });
  }
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
    const copyLink = page.getByRole("button", {
      name: "Copier le lien",
      exact: true,
    });
    if (viewport.width <= 720)
      await expect(copyLink).toBeInViewport({ ratio: 1 });
    else await expect(copyLink).toBeHidden();
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
  expect(
    await page
      .locator(".message-text")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(17);
  expect(
    await page
      .locator(".publication-menu-trigger")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  await page
    .getByRole("button", { name: "Passer au mode sombre", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Actions du message de Alice", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Copier", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Modifier", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("menuitem", { name: "Supprimer", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/session-dark.png" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Passer au mode clair", exact: true })
    .click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.getByLabel("Votre message")).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.removeProperty("font-size");
  });
  await page.screenshot({
    path: "test-results/session-desktop.png",
    fullPage: true,
  });
  await guest.screenshot({
    path: "test-results/session-mobile.png",
    fullPage: true,
  });
  await expect(
    guest.getByRole("button", { name: "Gérer la session", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await guest
    .getByRole("button", { name: "Gérer la session", exact: true })
    .click();
  await expect(guest.getByLabel("Mon nom dans la session")).toHaveValue(
    "Alice",
  );
  await expect(guest.getByLabel("Adresse de la session")).toBeHidden();
  await expect(
    guest.getByRole("button", { name: "Supprimer maintenant", exact: true }),
  ).toBeHidden();
  await guest.getByLabel("Mon nom dans la session").fill("Jean-Louis");
  await guest.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(guest.getByRole("dialog").getByRole("alert")).toContainText(
    "déjà utilisé",
  );
  await guest.getByLabel("Mon nom dans la session").fill("Alicia");
  await guest.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(guest.getByRole("dialog")).toBeHidden();
  await expect(
    page.locator(".message-meta").getByText("Alicia", { exact: true }),
  ).toHaveCount(2);
  await expect(page.locator(".file-list")).toContainText("Alicia");
  await guest.reload();
  await expect(guest.getByLabel("Votre message")).toBeVisible();
  await guest
    .getByRole("button", { name: "Gérer la session", exact: true })
    .click();
  await expect(guest.getByLabel("Mon nom dans la session")).toHaveValue(
    "Alicia",
  );
  await guest.getByRole("button", { name: "Annuler", exact: true }).click();
  await guest
    .getByRole("button", { name: "Actions du message de Alicia", exact: true })
    .click();
  await expect(
    guest.getByRole("menuitem", { name: "Modifier", exact: true }),
  ).toBeVisible();
  await guest.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Gérer la session", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("form")).toHaveCount(1);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Enregistrer", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Session ouverte aux stagiaires", { exact: true }),
  ).toBeHidden();
  await page.getByLabel("Mon nom dans la session").fill("Alicia");
  await page.getByLabel("Adresse de la session").fill("nouvelle-adresse");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "déjà utilisé",
  );
  await expect(page).toHaveURL(/\/excel$/);
  await page.getByLabel("Mon nom dans la session").fill("Jean-Louis corrigé");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    guest
      .locator(".message-meta")
      .getByText("Jean-Louis corrigé", { exact: false })
      .first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/nouvelle-adresse$/);
  await page
    .getByRole("button", { name: "Gérer la session", exact: true })
    .click();
  await page.screenshot({ path: "test-results/session-settings.png" });
  await page.getByLabel("Mon nom dans la session").fill("Modification annulée");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page
    .getByRole("button", { name: "Gérer la session", exact: true })
    .click();
  await expect(page.getByLabel("Mon nom dans la session")).toHaveValue(
    "Jean-Louis corrigé",
  );
  await context.close();
  await otherContext.close();
});
