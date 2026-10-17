import { test, expect } from "@playwright/test";
test("第一阶段本地模式保留商品与经营数据编辑", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_DATA_MODE !== "local",
    "仅在显式本地演示模式运行",
  );
  await page.goto("/products");
  await expect(
    page.getByRole("heading", { name: /把商品的每一分利润算清楚/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新增商品" }).click();
  await page.getByPlaceholder("例如：月明净 洗衣液").fill("阶段二兼容测试商品");
  await page.getByPlaceholder("例如：衣物清洁").fill("测试");
  await page.getByPlaceholder("例如：2kg 家庭装").fill("单瓶");
  await page.getByRole("button", { name: "保存商品" }).click();
  await expect(page.getByText("阶段二兼容测试商品").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("阶段二兼容测试商品").first()).toBeVisible();
  await page.goto("/data");
  await expect(
    page.getByRole("heading", { name: /让经营数据有据可查/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).first().click();
  await page
    .locator('[role="dialog"] input[type="number"]')
    .nth(1)
    .fill("10000");
  await page.getByRole("button", { name: "保存数据" }).click();
  await page.goto("/dashboard");
  await expect(page.getByText("今日销售额")).toBeVisible();
  await expect(page.getByText("¥9836.00")).toBeVisible();
});
