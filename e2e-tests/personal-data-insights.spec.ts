import { expect, test } from "@playwright/test";

test("ask users to sign in before analyzing personal records", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze my saved data" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});
