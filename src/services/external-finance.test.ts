import { describe, expect, it } from "vitest";
import { mergeExternalDaily } from "./external-finance";
import type { DailyMetric } from "@/lib/model";

const manual: DailyMetric = {
  id:"manual",date:"2026-10-18",sales:"100.00",refunds:"0.00",orders:2,
  productCost:"10.00",packagingCost:"1.00",logisticsCost:"2.00",platformFees:"1.00",
  otherExpenses:"0.00",productSales:{},source:"manual",
};
describe("外部订单财务合并", () => {
  it("按店铺时区归日、用十进制汇总且手工日汇总优先", () => {
    const result = mergeExternalDaily([manual],[
      {id:"a",placed_at:"2026-10-17T15:00:00Z",gross_sales:"0.10",status:"completed",is_demo:true},
      {id:"b",placed_at:"2026-10-17T15:30:00Z",gross_sales:"0.20",status:"paid",is_demo:true},
      {id:"c",placed_at:"2026-10-17T16:00:00Z",gross_sales:"50.00",status:"completed",is_demo:true},
      {id:"d",placed_at:"2026-10-17T16:00:00Z",gross_sales:"40.00",status:"cancelled",is_demo:true},
    ],[{order_id:"a",amount:"0.05",status:"succeeded"}],"Asia/Shanghai");
    expect(result).toHaveLength(2);
    expect(result.find(row => row.source==="mock_pinduoduo")).toMatchObject({
      date:"2026-10-17",sales:"0.30",refunds:"0.05",orders:2,costComplete:false,
    });
    expect(result.find(row => row.date==="2026-10-18")).toEqual(manual);
  });
  it("映射 SKU 后按生效成本版本估算贡献成本", () => {
    const rows=mergeExternalDaily([], [{id:"order",connection_id:"connection",placed_at:"2026-10-18T00:00:00Z",gross_sales:"29.90",status:"paid",is_demo:true}],[],"Asia/Shanghai",{
      items:[{order_id:"order",external_sku_id:"external-code",quantity:1,gross_sales:"29.90"}],
      externalSkus:[{id:"external-sku",connection_id:"connection",external_id:"external-code"}],
      mappings:[{external_sku_id:"external-sku",sku_id:"internal-sku"}],
      internalSkus:[{id:"internal-sku",product_id:"product"}],
      costs:[
        {id:"old",sku_id:"internal-sku",product_cost:"5.00",packaging_cost:"1.00",shipping_cost:"2.00",platform_fee:"1.00",effective_from:"2026-01-01",created_at:"2026-01-01T00:00:00Z"},
        {id:"current",sku_id:"internal-sku",product_cost:"8.00",packaging_cost:"1.50",shipping_cost:"2.00",platform_fee:"1.00",effective_from:"2026-10-18",created_at:"2026-10-18T00:00:00Z"},
      ],
    });
    expect(rows[0]).toMatchObject({productCost:"8.00",packagingCost:"1.50",logisticsCost:"2.00",platformFees:"1.00",costComplete:true,productSales:{product:"29.90"}});
  });
});
