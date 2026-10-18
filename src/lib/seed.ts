import type { AppData, DailyMetric, Product } from "./model";
import { DATA_VERSION } from "./model";
const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const today = () => dateOffset(0);
const products: Product[] = [
  {
    id: "p-laundry",
    name: "月明净 洗衣液",
    category: "衣物清洁",
    createdAt: dateOffset(35),
    isDemo: true,
    skus: [
      {
        id: "s-laundry-1",
        name: "2kg 家庭装",
        price: "39.90",
        cost: {
          production: "12.50",
          packaging: "2.20",
          logistics: "5.50",
          platform: "1.80",
        },
      },
      {
        id: "s-laundry-2",
        name: "5kg 实惠装",
        price: "79.90",
        cost: {
          production: "27.00",
          packaging: "3.50",
          logistics: "8.00",
          platform: "3.50",
        },
      },
    ],
  },
  {
    id: "p-kitchen",
    name: "月明净 油污净",
    category: "厨房清洁",
    createdAt: dateOffset(31),
    isDemo: true,
    skus: [
      {
        id: "s-kitchen-1",
        name: "500ml 双瓶装",
        price: "29.90",
        cost: {
          production: "8.00",
          packaging: "2.00",
          logistics: "4.80",
          platform: "1.40",
        },
      },
    ],
  },
  {
    id: "p-bath",
    name: "月明净 浴室泡泡清洁剂",
    category: "浴室清洁",
    createdAt: dateOffset(28),
    isDemo: true,
    skus: [
      {
        id: "s-bath-1",
        name: "650ml 单瓶装",
        price: "34.90",
        cost: {
          production: "9.40",
          packaging: "1.90",
          logistics: "4.60",
          platform: "1.60",
        },
      },
    ],
  },
];
export function demoData(): AppData {
  const daily: DailyMetric[] = Array.from({ length: 30 }, (_, i) => {
    const day = 29 - i;
    const wave = Math.sin(i * 0.55);
    const sales = Math.round(4100 + i * 74 + wave * 650);
    const orders = Math.round(sales / 42);
    const laundrySales = Math.round(sales * 0.52);
    const kitchenSales = Math.round(sales * 0.29);
    return {
      id: `d-${dateOffset(day)}`,
      date: dateOffset(day),
      sales: String(sales),
      refunds: String(Math.round(sales * 0.027)),
      orders,
      productCost: String(Math.round(sales * 0.33)),
      packagingCost: String(Math.round(sales * 0.052)),
      logisticsCost: String(Math.round(sales * 0.115)),
      platformFees: String(Math.round(sales * 0.043)),
      otherExpenses: String(Math.round(125 + i * 1.3)),
      productSales: {
        "p-laundry": String(laundrySales),
        "p-kitchen": String(kitchenSales),
        "p-bath": String(sales - laundrySales - kitchenSales),
      },
      isDemo: true,
    };
  });
  const advertising = daily.map((row, i) => ({
    id: `a-${row.date}`,
    date: row.date,
    spend: String(
      Math.round(Number(row.sales) * (0.17 + Math.sin(i * 0.4) * 0.018)),
    ),
    attributedSales: String(
      Math.round(Number(row.sales) * (0.53 + Math.sin(i * 0.5) * 0.04)),
    ),
    isDemo: true,
  }));
  return {
    version: DATA_VERSION,
    products,
    daily,
    advertising,
    settings: {
      store: {
        id: "store-1",
        name: "月明净旗舰店",
        platform: "pinduoduo",
        currency: "CNY",
        createdAt: dateOffset(35),
      },
      salesTarget: "180000",
      marginAlert: 12,
      role: "owner",
    },
  };
}

export function createEmptyLocalData(): AppData {
  const now = new Date().toISOString();
  return {
    version: DATA_VERSION,
    products: [],
    daily: [],
    advertising: [],
    tasks: [],
    inventory: [],
    inventoryMovements: [],
    settings: {
      store: {
        id: `local-${crypto.randomUUID()}`,
        name: "我的本地工作区",
        platform: "pinduoduo",
        currency: "CNY",
        createdAt: now,
        timezone: "Asia/Shanghai",
      },
      salesTarget: "10000",
      marginAlert: 12,
      role: "owner",
    },
  };
}
