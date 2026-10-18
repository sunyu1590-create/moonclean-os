import { z } from "zod";
import Decimal from "decimal.js";
import { DATA_VERSION, type AppData } from "./model";
import { demoData } from "./seed";
const KEY = "moonclean-os-data";
const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const dailySchema = z
  .object({
    id: z.string(),
    date: z.iso.date(),
    sales: money,
    refunds: money,
    orders: z.number().int().nonnegative(),
    productCost: money.or(z.literal("")),
    packagingCost: money.or(z.literal("")),
    logisticsCost: money.or(z.literal("")),
    platformFees: money.or(z.literal("")),
    otherExpenses: money,
    productSales: z.record(z.string(), money),
    isDemo: z.boolean().optional(),
    costComplete: z.boolean().optional(),
    costSource: z.enum(["manual", "sku"]).optional(),
    source: z.enum(["manual", "csv_import", "image_import"]).optional(),
  })
  .refine((v) => new Decimal(v.refunds).lte(v.sales), {
    message: "退款不能超过销售额",
    path: ["refunds"],
  });
export const advertisingSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  spend: money,
  attributedSales: money,
  attributedOrders: z.number().int().nonnegative().optional(),
  isDemo: z.boolean().optional(),
  source: z.enum(["manual", "csv_import", "image_import"]).optional(),
});
export const productSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  createdAt: z.string(),
  isDemo: z.boolean().optional(),
  skus: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1),
        code: z.string().max(100).optional(),
        price: money,
        cost: z.object({
          production: money,
          packaging: money,
          logistics: money,
          platform: money,
        }),
        costComplete: z.boolean().optional(),
        costHistory: z.array(z.object({ effectiveFrom: z.iso.date(), cost: z.object({production:money,packaging:money,logistics:money,platform:money}) })).optional(),
      }),
    )
    .min(1),
});
export const dataSchema = z.object({
  version: z.number(),
  products: z.array(productSchema),
  daily: z.array(dailySchema),
  advertising: z.array(advertisingSchema),
  settings: z.object({
    store: z.object({
      id: z.string(),
      name: z.string(),
      platform: z.enum(["pinduoduo", "douyin", "other"]),
      currency: z.enum(["CNY", "USD"]),
      createdAt: z.string(),
      timezone: z.string().optional(),
    }),
    salesTarget: money,
    marginAlert: z.number().min(0).max(100),
    role: z.enum(["owner", "admin", "editor", "viewer"]),
  }),
});
export interface DataRepository {
  load(storeId?: string): AppData | Promise<AppData>;
  save(data: AppData, previous?: AppData): void | Promise<void>;
  export(): string | Promise<string>;
  reset(): AppData | Promise<AppData>;
}
export class LocalStorageRepository implements DataRepository {
  load(): AppData {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seed = demoData();
      this.save(seed);
      return seed;
    }
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrate(parsed);
      return dataSchema.parse(migrated) as AppData;
    } catch {
      localStorage.setItem(`${KEY}-recovery-${Date.now()}`, raw);
      const seed = demoData();
      this.save(seed);
      return seed;
    }
  }
  save(data: AppData) {
    localStorage.setItem(
      KEY,
      JSON.stringify(dataSchema.parse({ ...data, version: DATA_VERSION })),
    );
  }
  export() {
    return JSON.stringify(this.load(), null, 2);
  }
  reset() {
    const seed = demoData();
    this.save(seed);
    return seed;
  }
}
export function migrate(data: unknown): unknown {
  if (!data || typeof data !== "object") throw new Error("无效数据");
  const version = (data as { version?: number }).version;
  if (version === DATA_VERSION) return data;
  if (version === 0) {
    const old = data as AppData;
    return {
      ...old,
      version: DATA_VERSION,
      settings: {
        ...old.settings,
        role: "owner",
        store: {
          ...old.settings.store,
          currency: old.settings.store.currency || "CNY",
        },
      },
    };
  }
  throw new Error(`不支持的数据版本：${version}`);
}
export const repository = new LocalStorageRepository();

export function parseAppData(value: unknown): AppData {
  return dataSchema.parse(migrate(value)) as AppData;
}
export function hasLocalData(): boolean {
  return (
    typeof localStorage !== "undefined" && localStorage.getItem(KEY) !== null
  );
}
export function readLocalRaw(): string | null {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
}
