import { expect, test } from "@playwright/test";

test.describe("运营功能工作台（本机模式）", () => {
  test.skip(process.env.NEXT_PUBLIC_DATA_MODE !== "local", "需要显式开启本机演示数据模式");

  test("备忘录创建后刷新仍可检索", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "新建笔记" }).click();
    await page.getByLabel("笔记标题").fill("E2E 促销复盘");
    await page.getByLabel("Markdown 笔记正文").fill("## 数据依据\n\n记录近七日实际表现。");
    await page.getByRole("button", { name: "保存笔记" }).click();
    await expect(page.getByText("E2E 促销复盘").first()).toBeVisible();
    await page.getByRole("button", { name: "转为任务" }).click();
    await page.goto("/tasks");
    await page.getByRole("link", { name: "返回来源：运营备忘录" }).click();
    await expect(page.getByLabel("笔记标题")).toHaveValue("E2E 促销复盘");
    await page.reload();
    await expect(page.getByText("E2E 促销复盘").first()).toBeVisible();
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
