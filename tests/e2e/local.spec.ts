import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/seed";
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

test("本机与云端工作区切换会呈现过场并保持数据各自独立", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_DATA_MODE !== "local",
    "仅在显式本地演示模式运行",
  );
  const cloudData = demoData();
  cloudData.settings.store.id = "store-test";
  cloudData.settings.store.name = "自动化测试云店铺";
  await page.route("**/api/stores", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      stores: [{ id: "store-test", name: "自动化测试云店铺", platform: "pinduoduo", currency: "CNY", timezone: "Asia/Shanghai", role: "owner" }],
      user: { id: "user-test", email: "test@example.com" },
    }),
  }));
  await page.route("**/api/stores/store-test/data", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(cloudData),
  }));
  await page.route("**/api/stores/store-test/tasks", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tasks: [] }),
  }));

  await page.goto("/tasks", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "正在准备经营空间" })).toBeVisible();
  await expect(page.getByRole("button", { name: "切换本地数据或云端数据" })).toContainText("本地数据");
  await page.getByLabel("标题").fill("只保存在本地的任务");
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(page.getByRole("dialog").getByText("已保存到当前设备")).toBeVisible();
  await page.getByRole("button", { name: "知道了" }).click();

  await page.getByRole("button", { name: "切换本地数据或云端数据" }).click();
  const sourceDialog = page.getByRole("dialog");
  await sourceDialog.getByRole("button").filter({ hasText: "安全保存在云端" }).click();
  await expect(page.getByText("正在切换到云端数据")).toBeVisible();
  await expect(page.getByText("读取可访问的云端店铺")).toBeVisible();
  await expect(page.getByRole("button", { name: "切换本地数据或云端数据" })).toContainText("云端数据");
  await expect(page.getByText("只保存在本地的任务")).toHaveCount(0);

  await page.getByRole("button", { name: "切换本地数据或云端数据" }).click();
  await page.getByRole("dialog").getByRole("button").filter({ hasText: "保存在此设备的浏览器中" }).click();
  await expect(page.getByText("正在切换到本地数据")).toBeVisible();
  await expect(page.getByRole("button", { name: "切换本地数据或云端数据" })).toContainText("本地数据");
  await expect(page.getByText("只保存在本地的任务")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "切换本地数据或云端数据" })).toContainText("本地数据");
  await expect(page.getByText("只保存在本地的任务")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "智能经营建议" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "运营待办" })).toBeVisible();
  await expect(page.getByText("只保存在本地的任务")).toBeVisible();
});

test("本地全量备份可以预览、备份当前数据并恢复", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  const backup = demoData();
  backup.settings.store.name = "从备份恢复的店铺";
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /让工作空间贴合你的店铺/ })).toBeVisible();
  await page.getByRole("button", { name: "导入本地全量备份" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "moonclean-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  const preview = page.getByRole("alertdialog");
  await expect(preview).toBeVisible();
  await expect(preview.getByText("从备份恢复的店铺")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await preview.getByRole("button", { name: "备份当前数据并导入" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("moonclean-local-before-restore");
  await expect(page.getByText("从备份恢复的店铺").first()).toBeVisible();
  await page.reload();
  await page.goto("/settings");
  await expect(page.locator('input').first()).toHaveValue("从备份恢复的店铺");
});

test("经营目标接受千位逗号并在刷新后保留", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.goto("/settings");
  const target = page.getByLabel("月销售目标");
  await target.fill("250,000");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByRole("button", { name: "已保存" })).toBeVisible();
  await expect(target).toHaveValue("250000");
  await page.reload();
  await page.goto("/settings");
  await expect(page.getByLabel("月销售目标")).toHaveValue("250000");
});

test("经营建议可以转成待办并在刷新后保留分析基线", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "智能经营建议" })).toBeVisible();
  await page.getByRole("button", { name: /转为待办|建任务/ }).first().click();
  await expect(page.getByRole("status")).toContainText("已创建跟进任务");
  await page.goto("/tasks");
  await expect(page.getByText("智能建议跟进").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("智能建议跟进").first()).toBeVisible();
});
