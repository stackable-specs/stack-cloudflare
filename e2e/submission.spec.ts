import { expect, test } from "@playwright/test";

test("a user submits an artifact and sees it published", async ({ page }) => {
  const title = `e2e-${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId(`status-${title}`)).toHaveText("published", { timeout: 20_000 });
});

test("a user sees validation errors for an empty title", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("alert")).toContainText("title is required");
});
