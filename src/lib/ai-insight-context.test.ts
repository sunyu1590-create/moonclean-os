import { describe, expect, it } from "vitest";
import { buildExceptionsFallback, containsRawMetricName, containsUnsupportedNumber, formatInsightFacts } from "./ai-insight-context";

describe("AI 经营建议事实整理", () => {
  it("用人类可读的指标名称代替 JSON 字段名", () => {
    const facts = formatInsightFacts("exceptions", { coverageDays: 3, periodDays: 7, missingCostDays: 2, todayDataMissing: true, refundRate: 18.72, refundRiskProducts: 0 });
    expect(facts).toContain("近 7 天全店日报退款金额占成交额的比例：18.72");
    expect(facts).toContain("两个指标不能直接互相验证");
    expect(facts).not.toContain("refundRate");
    expect(facts).not.toContain("coverageDays");
  });

  it("成本不完整时不向模型提供利润和保本线数值", () => {
    const facts = formatInsightFacts("exceptions", { missingCostDays: 2, estimatedProfit: 298.3, profitMargin: 18.5, breakEvenRoas: 2.4 });
    expect(facts).toContain("成本不完整，暂不提供可比较的利润值");
    expect(facts).not.toContain("298.3");
    expect(facts).not.toContain("18.5");
    expect(facts).not.toContain("2.4");
  });

  it("检测模型泄漏的字段名", () => {
    expect(containsRawMetricName("输入显示 `missingCostDays: 2`", ["missingCostDays"])).toBe(true);
    expect(containsRawMetricName("成本数据不完整", ["missingCostDays"])).toBe(false);
  });

  it("拦截当前指标中没有依据的数字", () => {
    const context = { coverageDays: 3, refundRate: 18.72 };
    expect(containsUnsupportedNumber("近 3 天覆盖，退款比例 18.72%", context)).toBe(false);
    expect(containsUnsupportedNumber("建议预算增加 20%", context)).toBe(true);
    expect(containsUnsupportedNumber("估算利润为 12", { estimatedProfit: -12 })).toBe(true);
  });

  it("遇到字段泄漏时能用明确口径生成可复核建议", () => {
    const answer = buildExceptionsFallback({ periodDays: 7, coverageDays: 3, todayDataMissing: true, missingCostDays: 2, refundRate: 18.72, refundRiskProducts: 0, exceptionCount: 2 });
    expect(answer).toContain("仅 3 天有日报记录");
    expect(answer).toContain("统计范围不同，不能据此判定矛盾");
    expect(answer).not.toContain("estimatedProfit");
  });
});
