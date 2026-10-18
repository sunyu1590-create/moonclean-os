export interface PinduoduoReportFields {
  date: string;
  sales: string;
  refunds: string;
  orders: string;
  spend: string;
  attributedSales: string;
  attributedOrders: string;
  buyers: string;
  averageOrderValue: string;
  visitors: string;
  conversionRate: string;
  refundOrders: string;
  visitorValue: string;
}

function findValue(lines: string[], labels: string[], percent = false, integer = false): string {
  const normalizedLabels = labels.map((label) => label.replace(/\s/g, ""));
  const numberPattern = /(?:￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万)?\s*(%)?/;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\s/g, "");
    const label = normalizedLabels.find((candidate) => line.includes(candidate));
    if (!label) continue;
    const position = line.indexOf(label) + label.length;
    let match = line.slice(position).replace(/[,，]/g, "").match(numberPattern);
    if (
      !match &&
      index + 1 < lines.length &&
      !normalizedLabels.some((candidate) =>
        lines[index + 1].replace(/\s/g, "").includes(candidate),
      )
    ) {
      match = lines[index + 1].replace(/[,，]/g, "").match(numberPattern);
    }
    if (match) {
      const value = Number(match[1]) * (match[2] && !percent ? 10000 : 1);
      return Number.isFinite(value)
        ? integer
          ? String(Math.round(value))
          : percent
          ? value.toFixed(4).replace(/\.?0+$/, "")
          : value.toFixed(2)
        : "";
    }
  }
  return "";
}

function parseDate(text: string, fallback: string) {
  const match = text.match(/(20\d{2})\s*[年\-/ .]\s*(\d{1,2})\s*[月\-/ .]\s*(\d{1,2})\s*日?/);
  return match
    ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
    : fallback;
}

export function parsePinduoduoReportText(
  raw: string,
  defaultDate: string,
): PinduoduoReportFields {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return {
    date: parseDate(raw, defaultDate),
    sales: findValue(lines, ["成交金额", "店铺成交额", "成交总额", "销售额", "成交额", "支付金额"]),
    refunds: findValue(lines, ["昨日退款金额", "退款金额", "售后退款", "退款总额"]),
    orders: findValue(lines, ["成交订单数", "支付订单数", "订单数", "订单量"], false, true),
    spend: findValue(lines, ["推广消耗", "广告消耗", "消耗金额", "推广花费", "广告花费"]),
    attributedSales: findValue(lines, ["广告归因成交额", "推广归因成交额", "广告成交金额", "推广成交金额", "广告成交额", "推广成交额", "直接成交金额", "直接成交额"]),
    attributedOrders: findValue(lines, ["推广订单数", "广告订单数", "推广成交订单数", "广告成交订单数", "直接成交订单数"], false, true),
    buyers: findValue(lines, ["成交买家数"], false, true),
    averageOrderValue: findValue(lines, ["客单价"]),
    visitors: findValue(lines, ["商品访客数", "访客数"], false, true),
    conversionRate: findValue(lines, ["成交转化率"], true),
    refundOrders: findValue(lines, ["昨日退款单数", "退款单数", "退款订单数"], false, true),
    visitorValue: findValue(lines, ["昨日访客价值", "访客价值"]),
  };
}
