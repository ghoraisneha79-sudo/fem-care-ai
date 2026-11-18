import { expect, test } from "@playwright/test";

test("select multiple daily symptoms and moods", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "How are you feeling today?" }).scrollIntoViewIfNeeded();
  await page.getByRole("checkbox", { name: "Cramps" }).check();
  await page.getByRole("checkbox", { name: "Low mood" }).check();
  await expect(page.getByRole("checkbox", { name: "Cramps" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Low mood" })).toBeChecked();
});
