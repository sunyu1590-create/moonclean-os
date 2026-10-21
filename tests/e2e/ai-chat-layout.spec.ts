import { expect, test } from "@playwright/test";

test("AI 聊天移动端填满导航上方空间，沉浸模式实际呈现内容并支持退出", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonclean-motion-level-v1", "simple"));
  await page.goto("/ai-chat");

  const chat = page.getByRole("region", { name: "AI 聊天窗口" });
  const nav = page.getByRole("navigation", { name: "主导航" });
  await expect(chat).toBeVisible();
  await expect(nav).toBeVisible();
  await expect.poll(async () => {
    const chatBounds = await chat.boundingBox();
    const navBounds = await nav.boundingBox();
    return chatBounds && navBounds ? Math.round(navBounds.y - chatBounds.y - chatBounds.height) : -1000;
  }).toBeGreaterThanOrEqual(-2);

  await page.getByRole("button", { name: "沉浸模式" }).click();
  const immersive = page.locator(".ai-chat-immersive");
  await expect(immersive).toBeVisible();
  await expect(immersive.getByRole("region", { name: "AI 聊天窗口" })).toBeVisible();
  await expect(immersive.getByRole("button", { name: "退出沉浸模式" })).toBeVisible();
  await expect.poll(() => immersive.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return [Math.round(width), Math.round(height)];
  })).toEqual([390, 844]);

  await page.keyboard.press("Escape");
  await expect(immersive).toHaveCount(0);
  await expect(chat).toBeVisible();
});
