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

test("更多面板从半屏展开，滚动内容后扩展到全屏", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonclean-motion-level-v1", "standard"));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "更多功能" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const initialMaxHeight = await sheet.evaluate((element) => parseFloat(getComputedStyle(element).maxHeight));
  expect(initialMaxHeight).toBeGreaterThan(450);
  expect(initialMaxHeight).toBeLessThan(500);
  await sheet.evaluate((element) => {
    element.scrollTop = 10;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(sheet).toHaveClass(/is-expanded/);
  await expect.poll(() => sheet.evaluate((element) => getComputedStyle(element).height)).toBe("844px");
  await expect(sheet).toHaveCSS("transition-duration", "0.38s");
});
