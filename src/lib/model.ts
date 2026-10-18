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
  /** Optional extra fields transcribed from a Pinduoduo operating report screenshot. */
  reportDetails?: {
    buyers?: number;
    averageOrderValue?: Money;
    visitors?: number;
    conversionRate?: Money;
    refundOrders?: number;
    visitorValue?: Money;
  };
  isDemo?: boolean;
  costComplete?: boolean;
  costSource?: "manual" | "sku";
  source?: "manual" | "csv_import" | "image_import" | "mock_pinduoduo" | "official_pinduoduo";
}
export interface AdvertisingMetric {
  id: string;
  date: string;
  spend: Money;
  attributedSales: Money;
  attributedOrders?: number;
  isDemo?: boolean;
  source?: "manual" | "csv_import" | "image_import" | "mock_pinduoduo" | "official_pinduoduo";
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
  /** Device-local operational data is never uploaded unless the user migrates it. */
  tasks?: LocalOperationTask[];
  inventory?: LocalInventoryBalance[];
  inventoryMovements?: LocalInventoryMovement[];
  externalCatalog?: { id: string; name: string; isDemo: boolean; skus: { id: string; name: string; code: string | null; price: Money; mappedSkuId: string | null }[] }[];
  settings: AppSettings;
}
export interface LocalOperationTask {
  id: string;
  title: string;
  detail: string;
  priority: "low" | "normal" | "high";
  status: "todo" | "doing" | "done";
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  recommendation_key?: string | null;
  recommendation_baseline?: RecommendationBaseline | null;
}
export interface RecommendationBaseline {
  captured_at: string;
  coverage_days: number;
  net_sales: Money;
  profit: Money;
  roas: number | null;
  refund_rate: number | null;
}
export interface LocalInventoryBalance {
  sku_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}
export interface LocalInventoryMovement {
  id: string;
  sku_id: string;
  quantity_before: number;
  quantity_after: number;
  delta: number;
  note: string;
  created_at: string;
}
export const DATA_VERSION = 1;
