export type Money = string;
export type Platform = "pinduoduo" | "douyin" | "other";
export type StoreRole = "owner" | "admin" | "editor" | "viewer";
export interface Store {
  id: string;
  name: string;
  platform: Platform;
  currency: "CNY" | "USD";
  createdAt: string;
  timezone?: string;
}
export interface SKUCost {
  production: Money;
  packaging: Money;
  logistics: Money;
  platform: Money;
}
export interface SKU {
  id: string;
  name: string;
  code?: string;
  price: Money;
  cost: SKUCost;
  costComplete?: boolean;
  costHistory?: { effectiveFrom: string; cost: SKUCost }[];
}
export interface Product {
  id: string;
  name: string;
  category: string;
  skus: SKU[];
  createdAt: string;
  isDemo?: boolean;
}
export interface DailyMetric {
  id: string;
  date: string;
  sales: Money;
  refunds: Money;
  orders: number;
  productCost: Money;
  packagingCost: Money;
  logisticsCost: Money;
  platformFees: Money;
  otherExpenses: Money;
  productSales: Record<string, Money>;
  isDemo?: boolean;
  costComplete?: boolean;
  costSource?: "manual" | "sku";
}
export interface AdvertisingMetric {
  id: string;
  date: string;
  spend: Money;
  attributedSales: Money;
  attributedOrders?: number;
  isDemo?: boolean;
}
export interface SKUDailyMetric { id: string; skuId: string; date: string; quantitySold: number; grossSales: Money; refundAmount: Money }
export interface FinancialSummary {
  grossSales: Money;
  refunds: Money;
  netSales: Money;
  productCost: Money;
  packagingCost: Money;
  logisticsCost: Money;
  platformFees: Money;
  adSpend: Money;
  otherExpenses: Money;
  totalCost: Money;
  profit: Money;
  margin: number | null;
  roas: number | null;
  breakEvenRoas: number | null;
}
export interface AppSettings {
  store: Store;
  salesTarget: Money;
  marginAlert: number;
  role: StoreRole;
}
export interface AppData {
  version: number;
  products: Product[];
  daily: DailyMetric[];
  advertising: AdvertisingMetric[];
  skuDaily?: SKUDailyMetric[];
  settings: AppSettings;
}
export const DATA_VERSION = 1;
