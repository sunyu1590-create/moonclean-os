import { z } from "zod";

export const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const orderSchema = z.object({
  externalId: z.string().min(1).max(120),
  status: z.enum(["paid", "shipped", "completed", "refunded", "cancelled"]),
  placedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  grossSales: money,
  items: z.array(z.object({
    externalSkuId: z.string().min(1),
    quantity: z.number().int().positive(),
    grossSales: money,
  })).min(1),
});
export const productSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  updatedAt: z.iso.datetime(),
  skus: z.array(z.object({
    externalId: z.string().min(1),
    code: z.string().optional(),
    name: z.string().min(1),
    price: money,
  })).min(1),
});
export const refundSchema = z.object({
  externalId: z.string().min(1),
  orderExternalId: z.string().min(1),
  amount: money,
  status: z.enum(["pending", "succeeded", "rejected"]),
  updatedAt: z.iso.datetime(),
});
export type NormalizedOrder = z.infer<typeof orderSchema>;
export type NormalizedProduct = z.infer<typeof productSchema>;
export type NormalizedRefund = z.infer<typeof refundSchema>;
export type SyncKind = "orders" | "products" | "refunds";
export type Page<T> = { records: T[]; nextCursor: string | null };
export type ListOptions = {
  cursor?: string | null;
  limit: number;
  from?: string;
  to?: string;
};
export type AdapterCapabilities = {
  orders: boolean;
  products: boolean;
  refunds: boolean;
  officialAuthorization: boolean;
};
export type AuthorizationStatus = "demo" | "unauthorized" | "authorized" | "expired";
export interface PinduoduoAdapter {
  getAuthorizationStatus(): Promise<AuthorizationStatus>;
  getAvailableCapabilities(): AdapterCapabilities;
  listOrders(options: ListOptions): Promise<Page<NormalizedOrder>>;
  listProducts(options: ListOptions): Promise<Page<NormalizedProduct>>;
  listRefunds(options: ListOptions): Promise<Page<NormalizedRefund>>;
}
