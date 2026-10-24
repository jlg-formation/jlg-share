import { test, expect } from "@playwright/test";

test("le thème suit le système puis mémorise le choix propre à chaque navigateur", async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Connexion administrateur" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator("input[type=password]")
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe("rgb(229, 238, 231)");
  await page.screenshot({ path: "test-results/connexion-dark.png" });
  await page
    .getByRole("button", { name: "Passer au mode clair", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Passer au mode sombre", exact: true }),
  ).toBeVisible();
  const otherContext = await browser.newContext({ colorScheme: "dark" });
  try {
    const other = await otherContext.newPage();
    await other.goto("/");
    await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally {
    await otherContext.close();
  }
});
