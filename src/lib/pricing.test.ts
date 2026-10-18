import { describe, expect, it } from "vitest";
import { calculatePricing, isMoneyInput, isRateInput } from "@/lib/pricing";

describe("定价模拟", () => {
  it("用十进制计算临时 SKU 的贡献利润与保本 ROAS", () => {
    const result = calculatePricing({
      price: "39.90",
      cost: { production: "12.40", packaging: "1.20", logistics: "3.50", platform: "1.00" },
      variableFeeRate: "5",
      targetMargin: "20",
    });
    expect(result.fixedCost.toFixed(2)).toBe("18.10");
    expect(result.variableCost.toFixed(2)).toBe("2.00");
    expect(result.contribution.toFixed(2)).toBe("19.81");
    expect(result.breakEvenRoas?.toFixed(2)).toBe("2.01");
    expect(result.targetPrice?.toFixed(2)).toBe("24.13");
  });

  it("成本或比例费用占满售价时不会计算不可达的目标价", () => {
    const result = calculatePricing({
      price: "10.00",
      cost: { production: "10.00", packaging: "0", logistics: "0", platform: "0" },
      variableFeeRate: "5",
      targetMargin: "95",
    });
    expect(result.contribution.toFixed(2)).toBe("-0.50");
    expect(result.breakEvenRoas).toBeNull();
    expect(result.targetPrice).toBeNull();
  });

  it("严格校验临时 SKU 金额和费用比例", () => {
    expect(isMoneyInput("0.00")).toBe(true);
    expect(isMoneyInput("1.234")).toBe(false);
    expect(isRateInput("100", 100)).toBe(true);
    expect(isRateInput("101", 100)).toBe(false);
  });
});
