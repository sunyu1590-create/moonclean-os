import { test, expect } from "@playwright/test";

test("手机底栏只在点击导航后更新选中位置，不跟随指针", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonclean-motion-level-v1", "refined"));
  await page.goto("/dashboard");

  const nav = page.getByRole("navigation", { name: "主导航" });
  const indicator = nav.locator(".mobile-active-indicator");
  const bounds = await nav.locator(".relative.grid").boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.5);
  await expect(indicator).toHaveAttribute("style", /translateX\(0%\)/);

  await nav.getByRole("link", { name: "商品管理" }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(indicator).toHaveAttribute("style", /translateX\(100%\)/);
  await expect(indicator).not.toHaveAttribute("style", /scale\(|rotate[XY]/);
  await expect(nav).not.toHaveClass(/is-following|is-pressed/);
});

test("更多面板跟随拖动在半屏、全屏和关闭状态间切换", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonclean-motion-level-v1", "standard"));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "更多功能" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);
  const halfHeight = 844 * 0.56;
  const initialHeight = await sheet.evaluate((element) => parseFloat(getComputedStyle(element).height));
  expect(initialHeight).toBeGreaterThan(450);
  expect(initialHeight).toBeLessThan(500);
  async function dragHandle(label: string, distance: number) {
    const handle = page.getByRole("button", { name: label });
    const bounds = await handle.boundingBox();
    expect(bounds).not.toBeNull();
    const x = bounds!.x + bounds!.width / 2;
    const y = bounds!.y + bounds!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(sheet).toHaveClass(/is-dragging/);
    await page.mouse.move(x, y - distance, { steps: 8 });
    await page.mouse.up();
  }
  await dragHandle("上滑展开更多功能", 180);
  await expect(sheet).toHaveClass(/is-expanded/);
  await expect.poll(() => sheet.evaluate((element) => getComputedStyle(element).height)).toBe("844px");
  await expect(sheet).toHaveCSS("transition-duration", "0.38s");
  await dragHandle("下滑收起更多功能", -180);
  await expect(sheet).not.toHaveClass(/is-expanded/);
  await expect.poll(() => sheet.evaluate((element) => parseFloat(getComputedStyle(element).height))).toBeCloseTo(halfHeight, 0);
  await dragHandle("上滑展开更多功能", -120);
  await expect(sheet).toBeHidden();
});
