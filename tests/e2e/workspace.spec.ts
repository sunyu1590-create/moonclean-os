import { expect, test } from "@playwright/test";

test.describe("运营功能工作台（本机模式）", () => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "需要显式开启本机演示数据模式");

  test("可切换并记住英文界面", async ({ page }) => {
    await page.goto("/dashboard");
    await page.goto("/settings");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /EN/ })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Good morning. See how your business is doing." })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page.getByRole("link", { name: "Overview" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Good morning. See how your business is doing." })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    const languageOption = page.getByRole("button", { name: "简体中文" });
    const toggleBox = await languageOption.boundingBox();
    expect(toggleBox?.x).toBeGreaterThanOrEqual(0);
    expect((toggleBox?.x || 0) + (toggleBox?.width || 0)).toBeLessThanOrEqual(390);
    await languageOption.click();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "早上好，今天的生意一目了然" })).toBeVisible();
  });

  test("笔记中心自动保存后刷新仍可检索并能转为待办", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "新建笔记" }).click();
    await page.getByLabel("笔记标题").fill("E2E 促销复盘");
    await page.getByLabel("笔记正文").fill("记录近七日实际表现。");
    await expect(page.getByText("已保存", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("E2E 促销复盘").first()).toBeVisible();
    await page.locator(".notes-editor-header").getByRole("button", { name: "更多笔记操作" }).click();
    await page.getByRole("button", { name: "转为运营待办" }).click();
    await page.goto("/tasks");
    await page.getByRole("link", { name: "返回来源：笔记中心" }).click();
    await expect(page.getByLabel("笔记标题")).toHaveValue("E2E 促销复盘");
    await page.reload();
    await expect(page.getByText("E2E 促销复盘").first()).toBeVisible();
  });

  test("编辑器 AI 入口可点击，删除后退出当前编辑页", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "新建笔记" }).click();
    await page.getByLabel("笔记标题").fill("E2E 删除后退出");
    await page.getByLabel("笔记正文").fill("确认 AI 底栏入口与删除后退出编辑。");
    await expect(page.getByRole("button", { name: "AI", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "AI 笔记助手" })).toBeVisible();
    await expect(page.getByRole("region", { name: "AI 笔记助手" })).toBeVisible();
    await page.getByRole("dialog", { name: "AI 笔记助手" }).getByRole("button", { name: "Close" }).click();
    await page.locator(".notes-editor-header").getByRole("button", { name: "更多笔记操作" }).click();
    await page.getByRole("button", { name: "移入回收站" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "移入回收站", exact: true }).last().click();
    await expect(page.getByRole("region", { name: "笔记编辑器" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "回收站" })).toBeVisible();
  });

  test("快速离开编辑器也会把本机草稿写入笔记列表", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "新建笔记" }).click();
    await page.getByLabel("笔记标题").fill("E2E 快速离开草稿");
    await page.getByLabel("笔记正文").fill("离开编辑器时仍然保留最新内容。");
    await page.getByRole("button", { name: "返回笔记列表" }).click();
    const row = page.locator(".notes-list-item").filter({ hasText: "E2E 快速离开草稿" });
    await expect(row).toBeVisible();
    await page.reload();
    await page.getByRole("textbox", { name: "搜索笔记" }).fill("E2E 快速离开草稿");
    await expect(page.locator(".notes-list-item").filter({ hasText: "E2E 快速离开草稿" })).toBeVisible();
  });

  test("手机笔记编辑器全屏工作且隐藏全局底部导航", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/notes");
    await expect.poll(async () => (await page.locator(".notes-fab").boundingBox())?.y ?? -1).toBeGreaterThan(600);
    await page.getByRole("button", { name: "新建笔记" }).click();
    await expect(page.getByRole("region", { name: "笔记编辑器" })).toBeVisible();
    const editorBox = await page.locator(".notes-editor-shell").boundingBox();
    expect(await page.locator(".notes-editor-shell").evaluate(element => getComputedStyle(element).filter)).toBe("none");
    expect(editorBox?.x).toBe(0);
    expect(editorBox?.y).toBe(0);
    expect(editorBox?.width).toBe(390);
    expect(editorBox?.height).toBe(844);
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeHidden();
    await expect(page.getByRole("textbox", { name: "笔记正文" })).toBeVisible();
    const aiButton = page.getByRole("button", { name: "AI", exact: true });
    await aiButton.click();
    const aiDialog = page.getByRole("dialog", { name: "AI 笔记助手" });
    await expect(aiDialog).toBeVisible();
    await expect(page.getByRole("region", { name: "AI 笔记助手" })).toBeVisible();
    const dialogBox = await aiDialog.boundingBox();
    expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox?.y).toBeGreaterThanOrEqual(0);
    expect((dialogBox?.x || 0) + (dialogBox?.width || 0)).toBeLessThanOrEqual(390);
    expect((dialogBox?.y || 0) + (dialogBox?.height || 0)).toBeLessThanOrEqual(844);
    expect(Math.abs((dialogBox?.y || 0) + (dialogBox?.height || 0) / 2 - 422)).toBeLessThan(30);
    await aiDialog.getByRole("button", { name: "Close" }).click();
    await expect(aiDialog).toBeHidden();
    expect(await page.locator(".notes-editor-bottom-bar").evaluate(element => getComputedStyle(element).position)).toBe("fixed");
  });

  test("笔记文件夹整理、归档和回收站恢复", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "新建笔记" }).click();
    await page.getByLabel("笔记标题").fill("E2E 文件夹归档笔记");
    await page.getByLabel("笔记正文").fill("文件夹、归档和恢复检查。");
    await expect(page.getByText("已保存", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    await page.locator(".notes-filter-row").getByRole("button", { name: "新建文件夹" }).click();
    const folderDialog = page.getByRole("dialog", { name: "新建文件夹" });
    await folderDialog.getByLabel("文件夹名称").fill("E2E 复盘文件夹");
    await folderDialog.getByRole("button", { name: "创建文件夹" }).click();
    await expect(page.locator(".notes-sidebar-pane").getByRole("button", { name: /E2E 复盘文件夹/ })).toBeVisible();

    await page.locator(".notes-editor-header").getByRole("button", { name: "更多笔记操作" }).click();
    await page.locator(".notes-editor-menu label").filter({ hasText: "文件夹" }).locator("select").selectOption({ label: "E2E 复盘文件夹" });
    await expect(page.getByText("已保存", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "关闭菜单" }).click();
    await page.getByRole("button", { name: "返回笔记列表" }).click();
    await page.locator(".notes-sidebar-pane").getByRole("button", { name: /E2E 复盘文件夹/ }).click();

    const row = page.locator(".notes-list-item").filter({ hasText: "E2E 文件夹归档笔记" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "笔记操作" }).click();
    await page.getByRole("button", { name: "归档", exact: true }).click();
    await page.locator(".notes-sidebar-pane").getByRole("button", { name: "归档笔记" }).click();
    const archivedRow = page.locator(".notes-list-item").filter({ hasText: "E2E 文件夹归档笔记" });
    await expect(archivedRow).toBeVisible();
    await archivedRow.getByRole("button", { name: "取消归档" }).click();
    await page.locator(".notes-sidebar-pane").getByRole("button", { name: "全部笔记" }).click();

    const restoredRow = page.locator(".notes-list-item").filter({ hasText: "E2E 文件夹归档笔记" });
    await restoredRow.getByRole("button", { name: "笔记操作" }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    const deleteDialog = page.getByRole("alertdialog");
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "移入回收站" }).click();
    await page.locator(".notes-sidebar-pane").getByRole("button", { name: "回收站" }).click();
    const trashedRow = page.locator(".notes-list-item").filter({ hasText: "E2E 文件夹归档笔记" });
    await expect(trashedRow).toBeVisible();
    await trashedRow.getByRole("button", { name: "恢复笔记" }).click();
    await expect(trashedRow).toHaveCount(0);
    await page.locator(".notes-sidebar-pane").getByRole("button", { name: "全部笔记" }).click();
    const folderRow = page.locator(".notes-sidebar-pane .group").filter({ hasText: "E2E 复盘文件夹" }).first();
    await folderRow.hover();
    await folderRow.getByRole("button", { name: "删除 E2E 复盘文件夹" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "删除文件夹" }).click();
    await expect(page.locator(".notes-sidebar-pane").getByRole("button", { name: /E2E 复盘文件夹/ })).toHaveCount(0);
    await expect(page.locator(".notes-list-item").filter({ hasText: "E2E 文件夹归档笔记" })).toBeVisible();
  });

  test("可创建实验并录入结果指标", async ({ page }) => {
    await page.goto("/experiments");
    await page.getByRole("button", { name: "新建实验" }).click();
    await page.getByLabel("实验名称").fill("E2E 主图卖点实验");
    await page.getByLabel("实验假设").fill("突出产品使用场景可能提高点击率。");
    await page.getByLabel("基准指标（JSON）").fill('{"点击率":2.1,"利润":-3}');
    await page.getByLabel("结果指标（JSON）").fill('{"点击率":2.8,"利润":1.2}');
    await page.getByRole("button", { name: "保存实验" }).click();
    await expect(page.getByText("E2E 主图卖点实验").first()).toBeVisible();
    await expect(page.getByText("普通前后对比").first()).toBeVisible();
  });

  test("可新增竞品档案并显示横向对比", async ({ page }) => {
    await page.goto("/competitors");
    await page.getByRole("button", { name: "添加竞品" }).click();
    await page.getByLabel("商品名称").fill("E2E 清洁剂竞品");
    await page.getByLabel("售价（元）").fill("29.90");
    await page.getByLabel("规格与容量").fill("500 毫升");
    await page.getByLabel("净含量（可选）").fill("500");
    await page.getByRole("button", { name: "保存档案" }).click();
    await expect(page.getByText("E2E 清洁剂竞品").first()).toBeVisible();
    await page.getByLabel("选择 E2E 清洁剂竞品 对比").check();
    await expect(page.getByText("竞品横向对比")).toBeVisible();
  });

  test("话术变量可填写并创建售后工单", async ({ page }) => {
    await page.goto("/service");
    await page.getByLabel("话术名称").fill("E2E 漏液回复");
    await page.getByLabel("回复内容").fill("您好，{{product_name}} 的问题我们会为您核实。");
    await page.getByRole("button", { name: "保存话术" }).click();
    await expect(page.getByText("E2E 漏液回复").first()).toBeVisible();
    await page.getByRole("button", { name: "售后工单" }).click();
    await page.getByLabel("订单号").fill("E2E-001");
    await page.getByLabel("问题描述").fill("清洁剂包装疑似漏液，需要核实。");
    await page.getByRole("button", { name: "创建售后工单" }).click();
    await expect(page.getByText("E2E-001").first()).toBeVisible();
  });

  test("本机演示模式明确提示 AI 未连接，不伪造回答", async ({ page }) => {
    await page.goto("/copilot");
    await expect(page.getByText("DeepSeek 未连接")).toBeVisible();
    await expect(page.getByPlaceholder("请先在 AI 设置中连接 DeepSeek。" )).toBeDisabled();
  });
});
