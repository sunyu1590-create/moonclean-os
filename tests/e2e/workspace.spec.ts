import { expect, test } from "@playwright/test";

test.describe("运营功能工作台（本机模式）", () => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "需要显式开启本机演示数据模式");

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
    expect(await page.locator(".notes-editor-shell").evaluate(element => getComputedStyle(element).animationName)).toBe("notes-editor-blur-reveal");
    expect(editorBox?.x).toBe(0);
    expect(editorBox?.y).toBe(0);
    expect(editorBox?.width).toBe(390);
    expect(editorBox?.height).toBe(844);
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeHidden();
    await expect(page.getByRole("textbox", { name: "笔记正文" })).toBeVisible();
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
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.locator(".notes-sidebar-pane").getByRole("button", { name: "回收站" }).click();
    const trashedRow = page.locator(".notes-list-item").filter({ hasText: "E2E 文件夹归档笔记" });
    await expect(trashedRow).toBeVisible();
    await trashedRow.getByRole("button", { name: "恢复笔记" }).click();
    await expect(trashedRow).toHaveCount(0);
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
    await expect(page.getByPlaceholder("请先在系统设置连接 DeepSeek。" )).toBeDisabled();
  });
});
