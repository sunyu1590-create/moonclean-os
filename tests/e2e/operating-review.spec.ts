import { expect, test } from "@playwright/test";

test("经营周期、数据来源和复盘路径在桌面与手机视口可读", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "需要本地演示工作区");

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);

    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "经营周期对比" })).toBeVisible();
    await expect(page.getByText("两期按相同天数计算")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/data");
    await expect(page.getByText("近 30 天数据质量与来源")).toBeVisible();
    await expect(page.getByText(/手工 \d+ · 导入 \d+ · 模拟 \d+ · 正式同步 \d+/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/experiments");
    await expect(page.getByRole("heading", { name: "一条实验记录的完整路径" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/inventory");
    await expect(page.getByText("按手动预警线判断；未结合销量与在途采购")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
