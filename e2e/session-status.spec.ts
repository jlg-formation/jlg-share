import { test, expect } from "@playwright/test";

test("suppression visible pour tous, actualisée en direct et indépendante du fuseau du navigateur", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Mot de passe administrateur")
    .fill("e2e-only-password");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await page.getByLabel("Titre de la session").fill("Barre de statut");
  await page
    .getByRole("button", { name: "Créer et ouvrir la session" })
    .click();
  await expect(page.getByLabel("Votre message")).toBeVisible();
  await expect(page.locator(".participant-count")).toHaveText(
    "1 formateur + 0 participant",
  );
  const path = "/api/sessions/" + new URL(page.url()).pathname.slice(1);
  const initial = await (await page.request.get(path)).json();
  const context = await browser.newContext({ timezoneId: "America/New_York" });
  try {
    const guest = await context.newPage();
    await guest.goto(page.url());
    await guest.getByLabel("Votre pseudo").fill("Alice");
    await guest.getByRole("button", { name: "Rejoindre la session" }).click();
    for (const viewer of [page, guest])
      await expect(viewer.locator(".participant-count")).toHaveText(
        "1 formateur + 1 participant",
      );
    // A distinct browser identity is required for a second trainee.
    const secondContext = await browser.newContext();
    try {
      const second = await secondContext.newPage();
      await second.goto(page.url());
      await second.getByLabel("Votre pseudo").fill("Bob");
      await second
        .getByRole("button", { name: "Rejoindre la session" })
        .click();
      for (const viewer of [page, guest, second])
        await expect(viewer.locator(".participant-count")).toHaveText(
          "1 formateur + 2 participants",
        );
    } finally {
      await secondContext.close();
    }
    const status = guest.getByRole("contentinfo", {
      name: "Suppression de la session",
    });
    const adminStatus = page.getByRole("contentinfo", {
      name: "Suppression de la session",
    });
    await expect(status.locator("time")).toHaveAttribute(
      "datetime",
      new Date(initial.expiresAt).toISOString(),
    );
    await expect(status.locator("time")).toHaveText(
      await adminStatus.locator("time").innerText(),
    );
    await page.getByRole("button", { name: "Gérer la session" }).click();
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByRole("radio", { name: "Dans 72 h", exact: true }).check();
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const updated = await (await page.request.get(path)).json();
    await expect(status.locator("time")).toHaveAttribute(
      "datetime",
      new Date(updated.expiresAt).toISOString(),
    );
    const formatted = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(updated.expiresAt);
    await expect(status).toContainText(formatted);
    await expect(status).toContainText("heure de Paris");
    for (const theme of ["light", "dark"] as const) {
      await guest.emulateMedia({ colorScheme: theme });
      for (const width of [1280, 390, 320]) {
        await guest.setViewportSize({ width, height: 844 });
        await expect(status).toBeInViewport();
        await expect(guest.locator(".participant-count")).toBeInViewport({
          ratio: 1,
        });
        expect(
          await guest.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const box = await status.boundingBox();
        expect(box!.y + box!.height).toBe(844);
        expect(box!.height).toBeLessThan(110);
        expect(
          await status.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        const composer = await guest.getByLabel("Votre message").boundingBox();
        expect(composer!.y + composer!.height).toBeLessThanOrEqual(box!.y);
        await guest.screenshot({
          path: `test-results/status-${theme}-${width}.png`,
        });
        if (width < 600) {
          await guest.getByRole("button", { name: "Fichiers & écran" }).click();
          await expect(status).toBeInViewport();
          await guest
            .getByRole("button", { name: "Messages", exact: true })
            .click();
        }
      }
    }
  } finally {
    await context.close();
  }
});
