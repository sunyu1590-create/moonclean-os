import { test, expect } from "@playwright/test";

for (const level of ["refined", "standard", "simple"] as const) {
  test(`手机底栏在${level}动效下实时跟随指针`, async ({ page }) => {
    test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((motionLevel) => {
      localStorage.setItem("moonclean-motion-level-v1", motionLevel);
    }, level);
    await page.goto("/dashboard");

    const nav = page.getByRole("navigation", { name: "主导航" });
    const grid = nav.locator(".relative.grid");
    const bounds = await grid.boundingBox();
    expect(bounds).not.toBeNull();
    const indicator = nav.locator(".mobile-active-indicator");

    await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.5);
    await expect(indicator).toHaveAttribute("style", /translateX\(150%\)/);
    await expect(indicator).toHaveCSS("transition-duration", "0s");

    if (level === "refined") {
      await expect.poll(() => indicator.evaluate((element) => getComputedStyle(element, "::after").filter)).toBe("blur(17px)");
      await page.mouse.move(bounds!.x + bounds!.width * 0.2, bounds!.y + bounds!.height * 0.55);
      await page.mouse.down();
      await expect(nav).toHaveClass(/is-pressed/);
      await page.mouse.move(bounds!.x + bounds!.width * 0.7, bounds!.y + bounds!.height * 0.25, { steps: 5 });
      await expect(indicator).toHaveAttribute("style", /scale\(0\.96\)/);
      await expect(indicator).not.toHaveAttribute("style", /rotate[XY]/);
      await page.mouse.up();
    }

    await page.getByRole("button", { name: "更多功能" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const sheetBounds = await sheet.boundingBox();
    expect(sheetBounds?.height).toBeGreaterThan(800);
    if (level === "refined") {
      await expect(sheet).toHaveCSS("transition-duration", "0.98s");
    } else if (level === "standard") {
      await expect(sheet).toHaveCSS("transition-duration", "0.76s");
    }
  });
}

test("手机底栏点击入口后高亮停在目标项，不出现倾斜变换", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonclean-motion-level-v1", "refined"));
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "主导航" });
  const indicator = nav.locator(".mobile-active-indicator");
  await nav.getByRole("link", { name: "商品管理" }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(indicator).toHaveAttribute("style", /translateX\(100%\)/);
  await expect(indicator).not.toHaveAttribute("style", /rotate[XY]/);
});
