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


test("登录页在桌面和手机布局正常，并支持显示与隐藏密码", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await expect(page.getByRole("img", { name: "月明净品牌标志" })).toBeVisible();
  await page.getByRole("button", { name: "切换界面语言为英文" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle day and night mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator(".auth-page")).toHaveCSS("color-scheme", "dark");
  await page.getByRole("button", { name: "Toggle day and night mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await page.getByRole("button", { name: "Switch language to Chinese" }).click();
  const password = page.getByRole("textbox", { name: "密码" });
  await password.fill("secure-pass-123");
  await page.getByRole("button", { name: "显示密码" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "隐藏密码" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  const submit = page.getByRole("button", { name: "登录", exact: true });
  await expect(submit).toBeInViewport();
});
