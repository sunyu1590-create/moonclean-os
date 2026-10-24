import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { z } from "zod";
import { requireStore, rejectCrossOriginMutation } from "@/lib/supabase/auth";
import { refundReasonSchema, REFUND_REASONS } from "@/lib/after-sales";
import { streamDeepSeekText } from "@/lib/ai-stream";

const inputSchema = z.object({ apiKey: z.string().trim().min(20).max(512), days: z.union([z.literal(7), z.literal(30), z.literal(90)]), language: z.enum(["zh-CN", "en-US"]).default("zh-CN") });
const recentRequests = new Map<string, number>();

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "分析周期无效，请选择 7、30 或 90 天" }, { status: 400 });
  const key = parsed.data.apiKey;
  const now = Date.now();
  const last = recentRequests.get(auth.user.id) || 0;
  if (now - last < 15_000) return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  recentRequests.set(auth.user.id, now);

  const cutoff = new Date(now - parsed.data.days * 86400000).toISOString();
  const db = auth.supabase;
  const [orders, refunds, annotations] = await Promise.all([
    db.from("external_orders").select("id,placed_at,gross_sales").eq("store_id", storeId).gte("placed_at", cutoff).order("placed_at", { ascending: false }).limit(1000),
    db.from("external_refunds").select("id,external_id,order_id,amount,status").eq("store_id", storeId).limit(1000),
    db.from("mock_platform_events").select("external_id,payload").eq("store_id", storeId).eq("kind", "refund"),
  ]);
  const failed = [orders.error, refunds.error, annotations.error].find(Boolean);
  if (failed) return NextResponse.json({ error: "读取售后数据失败，请检查店铺连接后重试" }, { status: 500 });
  const orderIds = new Set((orders.data || []).map((row) => row.id));
  const selectedRefunds = (refunds.data || []).filter((row) => orderIds.has(row.order_id));
  const payloads = new Map((annotations.data || []).map((row) => [row.external_id, row.payload as { reason?: unknown } | null]));
  const reasonCounts = new Map<string, { count: number; amount: Decimal }>();
  let unclassified = 0;
  for (const refund of selectedRefunds) {
    const reason = payloads.get(refund.external_id)?.reason;
    const validReason = refundReasonSchema.safeParse(reason);
    if (!validReason.success) { unclassified += 1; continue; }
    const current = reasonCounts.get(validReason.data) || { count: 0, amount: new Decimal(0) };
    current.count += 1;
    current.amount = current.amount.plus(refund.amount);
    reasonCounts.set(validReason.data, current);
  }
  const labels = new Map(REFUND_REASONS.map((reason) => [reason.value, reason.label]));
  const categories = [...reasonCounts].map(([reason, value]) => ({ reason: labels.get(reason as z.infer<typeof refundReasonSchema>), count: value.count, amount: value.amount.toFixed(2) })).sort((a, b) => b.count - a.count);
  const sales = (orders.data || []).reduce((sum, row) => sum.plus(row.gross_sales), new Decimal(0));
  const refunded = selectedRefunds.filter((row) => row.status === "succeeded").reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  const safeFacts = {
    periodDays: parsed.data.days,
    syncedOrderCount: orderIds.size,
    refundCount: selectedRefunds.length,
    successfulRefundAmount: refunded.toFixed(2),
    syncedOrderGrossSales: sales.toFixed(2),
    unclassifiedRefundCount: unclassified,
    issueCategories: categories,
  };
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 850,
        stream: true,
        messages: [
          { role: "system", content: parsed.data.language === "en-US" ? "You are an e-commerce after-sales operations analyst. Use only the supplied aggregate figures. Respond in concise, specific, actionable English. State sample-size and unclassified-data limitations. Do not claim causation or invent numbers. Rank issues by frequency and provide no more than three actions. Briefly state the visible evidence first; do not reveal internal reasoning." : "你是中国电商售后运营分析助手。只依据给出的汇总数字，用简体中文给出简洁、具体、可执行的分析。指出样本量和未分类限制；不能声称因果，不能编造数字。建议按问题频次排序，最多给出3条行动建议。开头简要说明可见数据依据，不展示内部推理草稿。" },
          { role: "user", content: `请分析以下脱敏汇总数据并给出问题排序和行动建议：${JSON.stringify(safeFacts)}` },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 401 ? "DeepSeek API Key 无效" : response.status === 429 ? "DeepSeek 请求频率受限，请稍后再试" : "DeepSeek 暂时无法完成分析，请稍后重试" }, { status: 502 });
    return streamDeepSeekText(response, () => ({ facts: safeFacts, model }));
  } catch {
    return NextResponse.json({ error: "连接 DeepSeek 超时或网络不可用，请稍后重试" }, { status: 502 });
  }
}
