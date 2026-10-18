import type { PinduoduoAdapter, Page, NormalizedOrder, NormalizedProduct, NormalizedRefund } from "./types";

// No endpoints, field names, OAuth flow or signatures are assumed here.
export class OfficialPinduoduoAdapter implements PinduoduoAdapter {
  async getAuthorizationStatus() { return "unauthorized" as const; }
  getAvailableCapabilities() {
    return { orders: false, products: false, refunds: false, officialAuthorization: false };
  }
  async listOrders(): Promise<Page<NormalizedOrder>> {
    throw new Error("NOT_CONFIGURED: 等待拼多多官方开放平台资质及应用授权");
  }
  async listProducts(): Promise<Page<NormalizedProduct>> {
    throw new Error("CAPABILITY_UNAVAILABLE: 尚未验证官方商品接口");
  }
  async listRefunds(): Promise<Page<NormalizedRefund>> {
    throw new Error("CAPABILITY_UNAVAILABLE: 尚未验证官方退款接口");
  }
}
