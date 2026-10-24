import { test, expect } from "@playwright/test";

test("avatars distincts par rôle, choix au clavier, diffusion et conservation", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(10_000);
  await page.goto("/");
  await page
    .getByLabel("Mot de passe administrateur")
    .fill("e2e-only-password");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await page.getByLabel("Titre de la session").fill("Les avatars en formation");
  const creationPicker = page.locator(".avatar-picker");
  await expect(creationPicker.getByRole("radio")).toHaveCount(6);
  await expect(
    creationPicker.getByRole("radio", { name: /^Avatar 21 :/ }),
  ).toBeChecked();
  await creationPicker.getByRole("radio", { name: /^Avatar 26 :/ }).check();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await creationPicker.scrollIntoViewIfNeeded();
      expect(
        await creationPicker.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/avatars-create-${theme}-${width}.png`,
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page
    .getByRole("button", { name: "Créer et ouvrir la session" })
    .click();
  await expect(page.getByLabel("Votre message")).toHaveAttribute(
    "placeholder",
    "Une idée, un lien, un petit mot ?",
  );
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Entrée pour envoyer/)).toHaveCount(0);
  const endpoint =
    "/api/sessions/" + new URL(page.url()).pathname.slice(1) + "/snapshot";
  const before = await (await page.request.get(endpoint)).json();
  expect(before.me.avatarId).toBe(26);
  await page.getByRole("button", { name: "Gérer la session" }).click();
  let dialog = page.getByRole("dialog");
  const trainerPicker = dialog.locator(".avatar-picker");
  await expect(trainerPicker.getByRole("radio")).toHaveCount(6);
  await expect(
    trainerPicker.getByRole("radio", { name: /^Avatar 26 :/ }),
  ).toBeChecked();
  await trainerPicker.getByRole("radio", { name: /^Avatar 24 :/ }).check();
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("Votre message").fill("Bienvenue !");
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(page.locator('.message svg[data-avatar-id="24"]')).toBeVisible();

  const context = await browser.newContext({ timezoneId: "Europe/Paris" });
  context.setDefaultTimeout(10_000);
  try {
    const guest = await context.newPage();
    await guest.goto(page.url());
    const picker = guest.locator(".avatar-picker");
    await expect(picker.getByRole("radio")).toHaveCount(20);
    const first = picker.getByRole("radio", { name: /^Avatar 1 :/ });
    await expect(first).toBeChecked();
    await first.focus();
    await first.press("ArrowRight");
    await expect(
      picker.getByRole("radio", { name: /^Avatar 2 :/ }),
    ).toBeChecked();
    await picker.getByRole("radio", { name: /^Avatar 8 :/ }).check();
    await guest.getByLabel("Votre pseudo").fill("Camille");
    await guest.getByRole("button", { name: "Rejoindre la session" }).click();
    await guest.getByLabel("Votre message").fill("Mon personnage est prêt.");
    await guest.getByRole("button", { name: "Envoyer le message" }).click();
    await guest.getByLabel("Choisir des fichiers").setInputFiles({
      name: "atelier.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Exercice fictif"),
    });
    await expect(page.locator('.message svg[data-avatar-id="8"]')).toHaveCount(
      2,
    );
    await guest.getByRole("button", { name: "Gérer la session" }).click();
    dialog = guest.getByRole("dialog");
    await expect(
      dialog.locator(".avatar-picker").getByRole("radio"),
    ).toHaveCount(20);
    await dialog.getByRole("radio", { name: /^Avatar 19 :/ }).check();
    for (const theme of ["light", "dark"] as const) {
      await guest.emulateMedia({ colorScheme: theme });
      for (const width of [1280, 390]) {
        await guest.setViewportSize({ width, height: 844 });
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await dialog.locator(".avatar-picker").scrollIntoViewIfNeeded();
        await guest.screenshot({
          path: `test-results/avatars-picker-${theme}-${width}.png`,
        });
      }
    }
    await dialog
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(page.locator('.message svg[data-avatar-id="19"]')).toHaveCount(
      2,
    );
    await expect(
      guest.locator('.message.own svg[data-avatar-id="19"]'),
    ).toHaveCount(2);
    await guest.reload();
    await expect(
      guest.locator('.message.own svg[data-avatar-id="19"]'),
    ).toHaveCount(2);
    await guest.getByRole("button", { name: "Gérer la session" }).click();
    await dialog.getByRole("radio", { name: /^Avatar 20 :/ }).check();
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(
      guest.locator('.message.own svg[data-avatar-id="19"]'),
    ).toHaveCount(2);
    for (const viewer of [page, guest]) {
      for (const width of [1280, 390]) {
        await viewer.setViewportSize({ width, height: 844 });
        const title = viewer.getByRole("heading", {
          name: "Les avatars en formation",
          exact: true,
        });
        await expect(title).toBeVisible();
        await expect(viewer.locator(".participant-count")).toBeInViewport({
          ratio: 1,
        });
        expect(
          await viewer.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await viewer.screenshot({
          path: `test-results/avatars-session-${viewer === page ? "trainer" : "guest"}-${width}.png`,
        });
      }
    }
    const after = await (await page.request.get(endpoint)).json();
    expect(after.session.expiresAt).toBe(before.session.expiresAt);
    expect(after.me.avatarId).toBe(24);
  } finally {
    await context.close();
  }
});
