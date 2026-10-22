import { test, expect } from "@playwright/test";

test("根路径恢复最近访问的有效页面", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_DATA_MODE !== "local",
    "路由恢复需要本地演示工作区",
  );

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("今日销售额")).toBeVisible();

  await page.goto("/motion");
  await expect(page.getByRole("heading", { name: "动效设置" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("moonclean-last-visited-route=%2Fmotion");

  await page.goto("/");
  await expect(page).toHaveURL(/\/motion$/);
  await expect(page.getByRole("heading", { name: "动效设置" })).toBeVisible();

  await page.goto("/products");
  await expect(page.getByRole("heading", { name: /把商品的每一分利润算清楚/ })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/products$/);
});
