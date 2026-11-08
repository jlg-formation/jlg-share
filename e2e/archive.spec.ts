import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readZip } from "../tests/zip-reader";

test("le stagiaire exporte la discussion et les fichiers depuis la barre de statut", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Mot de passe administrateur")
    .fill("e2e-only-password");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await page.getByLabel("Titre de la session").fill("Archive formation");
  await page
    .getByRole("button", { name: "Créer et ouvrir la session" })
    .click();
  await page
    .getByLabel("Votre message")
    .fill("Bonjour, voici les ressources !");
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await page.getByLabel("Choisir des fichiers").setInputFiles({
    name: "exercice été (1).txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenu partagé\r\n"),
  });
  await expect(page.locator(".file-list")).toContainText(
    "exercice été (1).txt",
  );
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await guest.goto(page.url());
    await guest.getByLabel("Votre pseudo").fill("Alice");
    await guest.getByRole("button", { name: "Rejoindre la session" }).click();
    await guest.getByLabel("Votre message").fill("Merci pour la formation !");
    await guest.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(
      guest.getByText("Merci pour la formation !", { exact: true }),
    ).toBeVisible();
    const action = guest.getByRole("link", { name: "Exporter une archive" });
    await expect(action).toBeVisible();
    const pending = guest.waitForEvent("download");
    await action.click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("archive-formation-archive.zip");
    await download.saveAs("test-results/formation-archive.zip");
    const zip = readZip(await readFile((await download.path())!));
    expect(zip.size).toBe(2);
    const md = zip.get("discussion.md")!.toString();
    expect(md).toContain("Bonjour, voici les ressources");
    expect(md).toContain("Merci pour la formation");
    expect(md).toContain("Alice");
    expect(md.indexOf("Bonjour")).toBeLessThan(md.indexOf("Merci"));
    expect(md).toContain("fichiers/1-exercice%20%C3%A9t%C3%A9%20%281%29.txt");
    expect(zip.get("fichiers/1-exercice été (1).txt")).toEqual(
      Buffer.from("contenu partagé\r\n"),
    );
    for (const theme of ["light", "dark"] as const) {
      await guest.emulateMedia({ colorScheme: theme });
      for (const width of [1280, 390, 320]) {
        await guest.setViewportSize({ width, height: 844 });
        await expect(action).toBeInViewport();
        await action.focus();
        await expect(action).toBeFocused();
        expect(
          await guest
            .locator(".session-status")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await guest.screenshot({
          path: `test-results/archive-${theme}-${width}.png`,
        });
      }
    }
  } finally {
    await context.close();
  }
});
