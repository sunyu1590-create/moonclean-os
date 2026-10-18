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
  await expect(page.getByLabel("店铺名称")).toHaveValue("从备份恢复的店铺");
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

test("动效切换展示版本与效果，调试浮窗可启停", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await page.getByRole("button", { name: /精致/ }).click();
  const transition = page.getByRole("status", { name: "正在切换到精致动效" });
  await expect(transition).toContainText("流光边缘");
  await expect(transition).toContainText("v0.8.1");
  await expect(transition).toContainText("当前为精致动效");
  await expect(transition).toHaveCount(0, { timeout: 8000 });
  const refreshOption = page.locator("label").filter({ hasText: "屏幕刷新率" }).locator("input[type=checkbox]");
  await refreshOption.uncheck();
  await page.getByRole("switch", { name: "启用性能调试浮窗" }).click();
  await expect(page.getByRole("button", { name: "网页性能调试信息" })).toBeVisible();
  await page.getByRole("button", { name: "网页性能调试信息" }).click();
  await expect(page.getByRole("region", { name: "性能调试面板" })).toBeVisible();
  const debugPanel = page.getByRole("region", { name: "性能调试面板" });
  await expect(debugPanel.getByText("页面帧率", { exact: true })).toBeVisible();
  await expect(debugPanel.getByText("屏幕刷新率", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "网页性能调试信息" })).toHaveCSS("animation-name", "none");
  await page.reload();
  await expect(page.getByRole("button", { name: "网页性能调试信息" })).toBeVisible();
  await expect(page.locator("label").filter({ hasText: "屏幕刷新率" }).locator("input[type=checkbox]")).not.toBeChecked();
});

test("定价工具可以创建不写入商品数据的临时 SKU", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.goto("/pricing");
  await page.getByRole("button", { name: "临时 SKU" }).click();
  await page.getByLabel("临时商品名称").fill("新品试算商品");
  await page.getByLabel("规格名称").fill("试算装");
  await page.getByLabel("预设售价（元）").fill("39.90");
  await page.getByRole("button", { name: "开始试算" }).click();
  await expect(page.getByText(/新品试算商品 · 试算装 · 仅本机临时数据/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "单件利润拆解" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("新品试算商品")).toHaveCount(0);
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

test("全站精致与简单动效可切换、详细过场显示并在刷新后保留", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "仅在显式本地演示模式运行");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await page.getByRole("button", { name: /精致/ }).click();
  const refinedTransition = page.getByRole("status", { name: "正在切换到精致动效" });
  await expect(refinedTransition).toBeVisible();
  await expect.poll(() => refinedTransition.evaluate(element => { const rect = element.getBoundingClientRect(); return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]; })).toEqual([0, 0, 390, 844]);
  await expect(refinedTransition).toContainText("启用流光边框、弹性回弹、柔光与丰富的浮层滑动");
  await expect(refinedTransition).toContainText("切换底栏与页面反馈");
  await expect(refinedTransition).toHaveCount(0, { timeout: 6000 });
  expect(await page.locator("html").getAttribute("data-motion")).toBe("refined");
  expect(await page.locator('nav[aria-label="主导航"]').evaluate(element => getComputedStyle(element).backdropFilter)).toContain("blur(18px)");

  await page.getByRole("button", { name: /简单/ }).click();
  const simpleTransition = page.getByRole("status", { name: "正在切换到简单动效" });
  await expect(simpleTransition).toBeVisible();
  await expect(simpleTransition).toContainText("关闭动画、模糊材质与装饰性动态效果");
  await expect(simpleTransition).toContainText("简单模式已就绪");
  await expect(simpleTransition).toHaveCount(0, { timeout: 3000 });
  expect(await page.locator("html").getAttribute("data-motion")).toBe("simple");
  await page.reload();
  await expect(page.getByRole("button", { name: /简单/ })).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("html").getAttribute("data-motion")).toBe("simple");
  expect(await page.locator('nav[aria-label="主导航"]').evaluate(element => getComputedStyle(element).backdropFilter)).toBe("none");
});
