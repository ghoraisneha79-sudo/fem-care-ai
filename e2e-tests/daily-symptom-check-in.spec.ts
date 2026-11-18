import { expect, test } from "@playwright/test";

test("require an account before saving a symptom check-in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "How are you feeling today?" }).scrollIntoViewIfNeeded();
  await page.getByLabel("Choose what you want to track").selectOption("cramps");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
