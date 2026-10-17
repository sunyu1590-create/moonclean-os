import { z } from "zod";
import Decimal from "decimal.js";
export const skuDailySchema=z.object({skuId:z.uuid(),date:z.iso.date(),quantitySold:z.number().int().nonnegative(),grossSales:z.string().regex(/^\d+(\.\d{1,2})?$/),refundAmount:z.string().regex(/^\d+(\.\d{1,2})?$/)}).refine(v=>new Decimal(v.refundAmount).lte(v.grossSales),{path:["refundAmount"],message:"退款不能超过销售额"});
