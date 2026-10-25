import type { AppData, Product } from "@/lib/model";
import type { DataRepository } from "@/lib/repository";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error("网络连接失败，请检查网络后重试");
  }
  const body = await response
    .json()
    .catch(() => ({ error: "服务器返回了无效响应" }));
  if (response.status === 401 && typeof window !== "undefined")
    window.dispatchEvent(new Event("moonclean-auth-expired"));
  if (!response.ok)
    throw new Error(body.error || `请求失败 (${response.status})`);
  return body as T;
}
export interface StoreChoice {
  id: string;
  name: string;
  platform: string;
  currency: string;
  timezone: string;
  role: "owner" | "admin" | "editor" | "viewer";
}
export async function listStores() {
  return request<{
    stores: StoreChoice[];
    user: { id: string; email: string };
  }>("/api/stores");
}
export async function createCloudStore(input: {
  name: string;
  platform: string;
  currency: string;
  timezone: string;
}) {
  return request<{ id: string }>("/api/stores", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export class SupabaseRepository implements DataRepository {
  private lastData: AppData | null = null;
  async load(storeId?: string): Promise<AppData> {
    if (!storeId) throw new Error("请先选择店铺");
    const data = await request<AppData>(`/api/stores/${storeId}/data`);
    this.lastData = data;
    return data;
  }
  async save(data: AppData, previous?: AppData): Promise<void> {
    const id = data.settings.store.id;
    if (!id || !previous || previous.settings.store.id !== id) throw new Error("未加载店铺数据");
    const endpoint = `/api/stores/${id}/mutate`;
    const send = (input: unknown) =>
      request(endpoint, { method: "POST", body: JSON.stringify(input) });
    const sendMany = async (inputs: unknown[]) => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < inputs.length) {
          const index = cursor++;
          await send(inputs[index]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, inputs.length) }, () => worker()),
      );
    };
    const oldProducts = new Map(previous.products.map((p) => [p.id, p]));
    const newProducts = new Map(data.products.map((p) => [p.id, p]));
    await sendMany(previous.products
      .filter((old) => !newProducts.has(old.id))
      .map((old) => ({ kind: "archiveProduct", productId: old.id })));
    await sendMany(data.products.flatMap((product) => {
      const old = oldProducts.get(product.id);
      return !old || productChanged(old, product)
        ? [{ kind: "saveProduct", product }]
        : [];
    }));
    const oldDaily = new Map(previous.daily.map((r) => [r.id, r]));
    await sendMany(data.daily.flatMap((row) => {
      const old = oldDaily.get(row.id);
      return !old || JSON.stringify(old) !== JSON.stringify(row)
        ? [{ kind: "saveDaily", row, originalDate: old?.date }]
        : [];
    }));
    const oldAds = new Map(previous.advertising.map((r) => [r.id, r]));
    await sendMany(data.advertising.flatMap((row) => {
      const old = oldAds.get(row.id);
      return !old || JSON.stringify(old) !== JSON.stringify(row)
        ? [{ kind: "saveAd", row, originalDate: old?.date }]
        : [];
    }));
    if (settingsChanged(previous, data))
      await send({
        kind: "saveSettings",
        settings: {
          name: data.settings.store.name,
          platform: data.settings.store.platform,
          currency: data.settings.store.currency,
          timezone: data.settings.store.timezone || "Asia/Shanghai",
          salesTarget: data.settings.salesTarget,
          marginAlert: data.settings.marginAlert,
        },
      });
    this.lastData = data;
  }
  export(): string {
    if (!this.lastData) throw new Error("尚未加载数据");
    return JSON.stringify(this.lastData, null, 2);
  }
  reset(): AppData {
    throw new Error("云端数据不能重置为模拟数据");
  }
}
function productChanged(a: Product, b: Product) {
  return (
    JSON.stringify({ name: a.name, category: a.category, skus: a.skus, isDemo:a.isDemo }) !==
    JSON.stringify({ name: b.name, category: b.category, skus: b.skus, isDemo:b.isDemo })
  );
}
function settingsChanged(a: AppData, b: AppData) {
  return (
    JSON.stringify({
      store: a.settings.store,
      target: a.settings.salesTarget,
      alert: a.settings.marginAlert,
    }) !==
    JSON.stringify({
      store: b.settings.store,
      target: b.settings.salesTarget,
      alert: b.settings.marginAlert,
    })
  );
}
