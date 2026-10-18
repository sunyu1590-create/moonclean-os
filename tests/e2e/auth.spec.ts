import { test, expect } from "@playwright/test";
test("未登录访问受保护页面会转到登录页", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE === "local", "本地演示模式不要求登录，认证保护仅在云端模式验证");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
});
test("邮箱密码登录及安全退出", async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "需提供已验证的 Supabase 测试账号",
  );
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("密码").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
test("跨店铺 API 访问被拒绝", async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL ||
      !process.env.E2E_PASSWORD ||
      !process.env.E2E_OTHER_STORE_ID,
    "需提供两个互不授权店铺的测试数据",
  );
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("密码").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const response = await page.request.get(
    `/api/stores/${process.env.E2E_OTHER_STORE_ID}/data`,
  );
  expect(response.status()).toBe(403);
});
