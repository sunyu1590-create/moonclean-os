import { describe, expect, it } from "vitest";
import { parsePinduoduoReportText } from "./report-ocr";

describe("拼多多经营日报截图字段识别", () => {
  it("识别数据中心日报模板里的成交、流量和退款指标", () => {
    const fields = parsePinduoduoReportText(
      `2026-10-18\n成交金额\n69.95\n成交订单数\n2\n成交买家数\n2\n客单价\n34.97\n商品访客数\n47\n成交转化率\n4.17%\n昨日退款金额\n17.80\n昨日退款单数\n2\n昨日访客价值\n0.27`,
      "2026-10-18",
    );
    expect(fields).toMatchObject({
      date: "2026-10-18",
      sales: "69.95",
      orders: "2",
      buyers: "2",
      averageOrderValue: "34.97",
      visitors: "47",
      conversionRate: "4.17",
      refunds: "17.80",
      refundOrders: "2",
      visitorValue: "0.27",
    });
  });

  it("只用明确的推广字段填广告归因成交额", () => {
    const fields = parsePinduoduoReportText(
      "店铺成交金额 100\n推广消耗 10\n直接成交额 25\n推广订单数 1",
      "2026-10-18",
    );
    expect(fields.spend).toBe("10.00");
    expect(fields.attributedSales).toBe("25.00");
    expect(fields.attributedOrders).toBe("1");
  });
});
