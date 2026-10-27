import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStore } from "@/lib/supabase/auth";
import { streamDeepSeekText } from "@/lib/ai-stream";
import { buildDataQualityFallback, buildExceptionsFallback, containsRawMetricName, containsUnsupportedNumber, formatInsightFacts } from "@/lib/ai-insight-context";

const featureSchema = z.enum(["dashboard", "exceptions", "advertising", "products", "finance", "data", "orders", "inventory", "tasks", "pricing", "product-insights", "reports", "integrations"]);
const safeValue = z.union([
  z.number().finite(),
  z.boolean(),
  z.enum(["数据不足", "成本数据不足", "未填写"]),
]);
const inputSchema = z.object({
  apiKey: z.string().trim().min(20).max(512),
  language: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
  feature: featureSchema,
  context: z.record(z.string().max(48), safeValue).refine((value) => Object.keys(value).length <= 24, "分析字段过多"),
});
const featureNames: Record<z.infer<typeof featureSchema>, string> = {
  dashboard: "经营总览", exceptions: "经营异常中心", advertising: "推广分析", products: "商品管理", finance: "财务利润",
  data: "经营数据质量", orders: "订单运营", inventory: "库存管理", tasks: "运营待办",
  pricing: "定价模拟", "product-insights": "商品诊断", reports: "经营报告", integrations: "平台同步健康度",
};
const allowedContextKeys: Record<z.infer<typeof featureSchema>, readonly string[]> = {
  dashboard: ["periodDays", "reportDays", "todaySales", "todayOrders", "todayAdSpend", "periodNetSales", "estimatedProfit", "profitMargin", "attributedAdRevenue", "adRoas", "costIncompleteDays"],
  exceptions: ["periodDays", "exceptionCount", "criticalCount", "warningCount", "infoCount", "lowStockCount", "zeroStockCount", "untrackedSkuCount", "overdueTasks", "missingCostDays", "negativeProfit", "marginBelowThreshold", "adsBelowBreakEven", "refundRiskProducts", "todayDataMissing", "coverageDays", "estimatedProfit", "profitMargin", "adRoas", "breakEvenRoas", "refundRate"],
  advertising: ["days", "adSpend", "attributedRevenue", "attributedOrders", "roas", "breakEvenRoas", "totalStoreSales"],
  products: ["productCount", "skuCount", "incompleteSkuCosts"],
  finance: ["periodDays", "grossSales", "refunds", "netSales", "productCost", "packagingCost", "logisticsCost", "platformFees", "adSpend", "otherExpenses", "estimatedProfit", "profitMargin", "costIncompleteDays"],
  data: ["recordCount", "daysMissingCosts", "daysWithProductSales", "latest7DaysSales", "latest7DaysOrders"],
  orders: ["totalOrders", "loadedOrders", "paidOrders", "shippedOrders", "completedOrders", "refundedOrders", "cancelledOrders", "otherStatusOrders", "grossSales", "refundCount", "pendingRefunds", "orderCount"],
  inventory: ["skuCount", "trackedSkuCount", "lowStockCount", "untrackedSkuCount"],
  tasks: ["totalTasks", "openTasks", "overdueTasks", "doingTasks", "highPriorityOpen", "dueSoon"],
  pricing: ["sellingPrice", "productionCost", "packagingCost", "shippingCost", "platformCost", "platformRatePercent", "targetMarginPercent", "estimatedContribution", "actualMarginPercent", "targetPrice"],
  "product-insights": ["periodDays", "productCount", "sales", "attentionCount", "lowContributionProducts", "incompleteCostProducts", "highRefundProducts"],
  reports: ["periodDays", "reportDays", "grossSales", "netSales", "refunds", "orderCount", "adSpend", "attributedAdRevenue", "adRoas", "estimatedProfit", "profitMargin", "costIncomplete"],
  integrations: ["connectionCount", "connected", "autoSync", "hasRecentSync", "jobCount", "failedJobs", "pendingJobs", "runningJobs", "successfulJobs"],
};
const recentRequests = new Map<string, number>();

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId, ["owner", "admin", "editor", "viewer"]);
  if (!auth.ok) return auth.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "AI 分析参数无效，请刷新页面后重试" }, { status: 400 });
  const allowedKeys = new Set(allowedContextKeys[parsed.data.feature]);
  if (Object.keys(parsed.data.context).some((field) => !allowedKeys.has(field))) return NextResponse.json({ error: "AI 分析仅接受页面提供的汇总指标" }, { status: 400 });

  const key = parsed.data.apiKey;
  const context = parsed.data.context;
  const facts = formatInsightFacts(parsed.data.feature, context);

  const now = Date.now();
  const last = recentRequests.get(auth.user.id) || 0;
  if (now - last < 12_000) return NextResponse.json({ error: "AI 请求较频繁，请稍后再试。" }, { status: 429 });
  recentRequests.set(auth.user.id, now);

  try {
  const systemPrompt = parsed.data.language === "en-US"
    ? "You are MoonClean OS's e-commerce operations analyst. Use only the supplied facts; never recalculate, invent, or guess numbers, products, plans, or causes. First assess coverage, period, and cost completeness. If coverage is incomplete, say exactly what is missing and how that limits the conclusion. If costs are incomplete, do not assess profit, margin, or break-even ROAS; recommend checking the source cost records first. The refund rate is based on store-wide daily reports for the last 7 days, while refund-risk product counts are SKU aggregates for the last 30 days; these scopes differ and must not be described as contradictory. Estimates and alert thresholds are not causal findings or industry standards. Give a short overall assessment followed by two or three prioritized actions. For each action, use clear labels for evidence, what it means or cannot establish, the next concrete check, and what to do after checking. Explain the important point instead of merely restating metrics; make each action specific enough to follow, while avoiding repetition and unsupported certainty. Use concise but useful Markdown, normally about 180–350 words total. Do not show field names, JSON, code, backticks, or internal reasoning. Use summary metrics only; never request or expose personal information, secrets, or credentials."
    : parsed.data.feature === "exceptions"
      ? "你是 MoonClean OS 的中国电商经营助手，负责解读经营异常中心。只根据用户消息中列出的中文事实作答，不要重算、补造或猜测任何数字、商品、计划或原因。先判断数据覆盖、日期范围和成本完整度，再区分哪些结论有依据、哪些仍待核实。若日报覆盖天数少于分析周期，明确这是不完整样本，不把它称为完整趋势；今日缺失要单独说明。只要成本不完整，就不得判断利润盈亏、利润率高低或推广是否达到保本，只建议补齐并核对成本后再评估。退款率是近7天全店日报退款金额/成交额，退款提示商品数是近30天按SKU汇总；两者统计范围和粒度不同，不得说它们互相矛盾。所有估算和提示线都不是因果结论或行业标准。先用两三句给出总体判断，再按优先级给出两至三条行动建议。每条建议都写清“数据依据”“这说明什么/不能说明什么”“下一步核查”和“核查后怎么处理”，把检查步骤写具体，避免只重复指标或给出空泛口号。使用简体中文 Markdown，内容完整、易执行，通常控制在约 180 至 350 字；不要为了简短省略关键限制，也不要重复铺陈。不得给出超出数据支持的经营决策。只展示面向用户的结论，不展示字段名、JSON、代码、反引号或内部推理。"
      : "你是 MoonClean OS 的中国电商经营助手。只根据用户消息列出的中文事实作答，不要重算、补造或猜测任何数字、商品、计划或原因。先评估数据覆盖、日期范围和成本完整度，再判断能支持什么结论。若覆盖不足或缺少关键指标，明确说明限制及其影响；不同周期、统计范围和指标口径不可直接互相比较。先写简短的总体判断，再按优先级给出两至三条建议。每条建议都包含“数据依据”“这说明什么/不能说明什么”“下一步核查”和“核查后怎么处理”；行动要具体到查看哪类页面数据、来源记录或口径，避免泛泛地说继续关注，也不要只复述数字。使用简体中文 Markdown，通常控制在约 180 至 350 字；保留关键限制，不重复堆叠背景。不得给出数据无法支持的确定结论。只使用汇总数据，不要求或输出个人信息、密钥或凭据；不要展示字段名、JSON、代码、反引号或内部推理。";
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.15,
        max_tokens: 760,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `功能：${featureNames[parsed.data.feature]}。请依据以下脱敏事实，不要提及或猜测其他信息：\n${facts}` },
        ],
      }),
      signal: AbortSignal.timeout(22_000),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "DeepSeek API Key 无效或没有访问权限。" : response.status === 429 ? "DeepSeek 请求频率受限，请稍后再试。" : "DeepSeek 暂时无法完成建议生成，请稍后重试。" }, { status: 502 });
    return streamDeepSeekText(
      response,
      () => ({ generatedAt: new Date().toISOString(), model: process.env.DEEPSEEK_MODEL || "deepseek-chat" }),
      undefined,
      (content) => {
        const leakedField = containsRawMetricName(content, allowedContextKeys[parsed.data.feature]);
        const unsupportedNumber = containsUnsupportedNumber(content, context);
        const falseRefundConflict = parsed.data.feature === "exceptions"
          && Number(context.refundRate) >= 10
          && Number(context.refundRiskProducts) === 0
          && /(不一致|矛盾|冲突)/.test(content);
        if (parsed.data.feature === "exceptions" && (leakedField || unsupportedNumber || falseRefundConflict)) {
          return parsed.data.language === "en-US"
            ? `Data coverage is limited: ${facts.split("\n").slice(0, 3).join("; ")}. Complete the missing daily records and costs before drawing conclusions about profit or break-even performance. Review refund definitions and date ranges before acting on the alert. The available summary does not support a more specific conclusion.`
            : buildExceptionsFallback(context);
        }
        if (parsed.data.feature === "data" && (leakedField || unsupportedNumber)) {
          return buildDataQualityFallback(context);
        }
        if (leakedField || unsupportedNumber) {
          return parsed.data.language === "en-US"
            ? `Evidence: ${facts.split("\n").slice(0, 3).join("; ")}.\n\nThe generated answer contained an internal metric reference, so it has been replaced with a safer summary. Check data coverage and source records first; the available summary does not support a more specific conclusion.`
            : `分析依据：${facts.split("\n").slice(0, 3).join("；")}。\n\n当前回复包含无法直接展示的内部指标标记，已改为依据页面汇总给出提示。请先核对本页数据完整度，再结合来源记录判断原因；现有汇总不足以支持更具体的结论。`;
        }
        return content;
      },
    );
  } catch {
    return NextResponse.json({ error: "连接 DeepSeek 超时或网络不可用，请检查网络后重试。" }, { status: 502 });
  }
}
