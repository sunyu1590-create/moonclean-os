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
  await expect(immersive.getByRole("button", { name: "聊天历史" })).toHaveCount(0);
  await immersive.getByRole("button", { name: "更多" }).click();
  await expect(immersive.getByLabel("选择模型")).toBeVisible();
  await expect(immersive.getByLabel("聊天分类")).toBeVisible();
  const reasoning = immersive.getByRole("group", { name: "推理强度", exact: true });
  await expect(reasoning).toBeVisible();
  await reasoning.getByRole("button", { name: "深入" }).click();
  await expect(reasoning).toHaveAttribute("data-effort", "max");
  await expect(reasoning.locator(".reasoning-indicator i")).toHaveCount(3);
  await expect.poll(() => immersive.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return [Math.round(width), Math.round(height)];
  })).toEqual([390, 844]);

  await page.keyboard.press("Escape");
  await expect(immersive).toHaveCount(0);
  await expect(chat).toBeVisible();
});

test("AI 聊天输入框内收纳更多设置并播放模糊放大动画", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonclean-motion-level-v1", "standard"));
  await page.goto("/ai-chat");

  const composerFooter = page.locator(".ai-chat-composer-footer");
  const more = composerFooter.getByRole("button", { name: "更多聊天设置" });
  await expect(composerFooter.getByText("Enter 发送")).toBeVisible();
  await expect(more).toBeVisible();
  const send = page.getByRole("button", { name: "发送消息" });
  const moreBounds = await more.boundingBox();
  const sendBounds = await send.boundingBox();
  expect(moreBounds).not.toBeNull();
  expect(sendBounds).not.toBeNull();
  expect(moreBounds!.x + moreBounds!.width).toBeLessThan(sendBounds!.x);

  await more.click();
  const panel = page.locator("#ai-chat-more-settings");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("animation-name", "ai-chat-more-enter");
  await expect(panel.getByLabel("选择模型")).toBeVisible();
  await expect(panel.getByLabel("聊天分类")).toBeVisible();
  const webSearch = panel.getByRole("checkbox", { name: "启用联网搜索" });
  await expect(webSearch).toBeVisible();
  await webSearch.check();
  await expect(webSearch).toBeChecked();
  await page.getByRole("button", { name: "聊天历史" }).click();
  const history = page.getByRole("dialog");
  await expect(history.getByRole("heading", { name: "聊天历史" })).toBeVisible();
  await expect(history.getByRole("textbox", { name: "搜索聊天历史" })).toBeVisible();
  await expect(history.getByRole("button", { name: /当前对话/ })).toBeVisible();
  await expect(history.getByRole("button", { name: /已归档/ })).toBeVisible();
  const historyBounds = await history.boundingBox();
  expect(historyBounds).not.toBeNull();
  expect(historyBounds!.width).toBeLessThanOrEqual(390);
});

test("标准通知显示在顶栏下方，设备适配通知显示在底栏上方", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.addInitScript(() => localStorage.setItem("moonclean-notification-style-v1", "glass"));
  await page.goto("/settings");
  await page.waitForTimeout(200); // Let the feedback event listener subscribe after hydration.

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    const title = `顶部通知 ${viewport.width}`;
    await page.evaluate((toastTitle) => window.dispatchEvent(new CustomEvent("moonclean:feedback", { detail: { kind: "info", title: toastTitle } })), title);
    const toast = page.locator(".feedback-toast").filter({ hasText: title });
    const toolbar = page.locator(".mc-toolbar");
    await expect(toast).toBeVisible();
    await expect.poll(async () => {
      const toastBounds = await toast.boundingBox();
      const toolbarBounds = await toolbar.boundingBox();
      return toastBounds && toolbarBounds ? Math.round(toastBounds.y - toolbarBounds.y - toolbarBounds.height) : -1000;
    }).toBeGreaterThanOrEqual(10);
    await toast.getByRole("button", { name: "关闭通知" }).click();
  }

  await page.evaluate(() => localStorage.setItem("moonclean-notification-style-v1", "adaptive"));
  await page.reload();
  await page.waitForTimeout(200);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    const title = `底部通知 ${viewport.width}`;
    await page.evaluate((toastTitle) => window.dispatchEvent(new CustomEvent("moonclean:feedback", { detail: { kind: "success", title: toastTitle } })), title);
    const toast = page.locator(".feedback-toast").filter({ hasText: title });
    await expect(toast).toBeVisible();
    const toastBounds = await toast.boundingBox();
    expect(toastBounds).not.toBeNull();
    if (viewport.width < 768) {
      const navBounds = await page.locator(".mobile-primary-nav").boundingBox();
      expect(navBounds).not.toBeNull();
      expect(toastBounds!.y + toastBounds!.height).toBeLessThan(navBounds!.y - 4);
    } else {
      expect(toastBounds!.y + toastBounds!.height).toBeLessThan(viewport.height - 12);
    }
    await toast.getByRole("button", { name: "关闭通知" }).click();
  }
});
