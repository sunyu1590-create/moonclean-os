import Decimal from "decimal.js";
import { z } from "zod";

export const refundReasonSchema = z.enum(["quality", "damaged", "missing", "description", "logistics", "buyer_change", "other"]);
export type RefundReason = z.infer<typeof refundReasonSchema>;
export const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: "quality", label: "清洁效果 / 质量问题" },
  { value: "damaged", label: "包装破损 / 渗漏" },
  { value: "missing", label: "漏发 / 少发商品" },
  { value: "description", label: "商品与描述不符" },
  { value: "logistics", label: "物流延误 / 配送问题" },
  { value: "buyer_change", label: "拍错 / 不再需要" },
  { value: "other", label: "其他原因" },
];

export type RefundIssueRecord = { amount: string; status: string; reason?: RefundReason | null; placedAt?: string };
export function summarizeRefundIssues(refunds: RefundIssueRecord[], since: number) {
  const filtered = refunds.filter((refund) => !refund.placedAt || new Date(refund.placedAt).getTime() >= since);
  const groups = new Map<RefundReason, { count: number; amount: Decimal }>();
  let unclassified = 0;
  for (const refund of filtered) {
    if (!refund.reason) { unclassified += 1; continue; }
    const current = groups.get(refund.reason) || { count: 0, amount: new Decimal(0) };
    current.count += 1;
    current.amount = current.amount.plus(refund.amount);
    groups.set(refund.reason, current);
  }
  const reasons = REFUND_REASONS.map(({ value, label }) => {
    const group = groups.get(value);
    return { reason: value, label, count: group?.count || 0, amount: group?.amount.toFixed(2) || "0.00" };
  }).sort((a, b) => b.count - a.count || new Decimal(b.amount).cmp(a.amount));
  return { total: filtered.length, unclassified, reasons: reasons.filter((item) => item.count > 0), topReason: reasons.find((item) => item.count > 0) || null };
}
