import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStore, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
import {
  productSchema,
  dailySchema,
  advertisingSchema,
} from "@/lib/repository";
const uuid = z.uuid();
const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(["pinduoduo", "douyin", "other"]),
  currency: z.enum(["CNY", "USD"]),
  timezone: z.string().min(1),
  salesTarget: z.string().regex(/^\d+(\.\d{1,2})?$/),
  marginAlert: z.number().min(0).max(100),
});
const mutation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saveProduct"), product: productSchema }),
  z.object({ kind: z.literal("archiveProduct"), productId: uuid }),
  z.object({
    kind: z.literal("saveDaily"),
    row: dailySchema,
    originalDate: z.iso.date().optional(),
  }),
  z.object({
    kind: z.literal("saveAd"),
    row: advertisingSchema,
    originalDate: z.iso.date().optional(),
  }),
  z.object({ kind: z.literal("saveSettings"), settings: settingsSchema }),
]);
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const crossOrigin=rejectCrossOriginMutation(request);if(crossOrigin)return crossOrigin;
  const { storeId } = await params;
  if (!uuid.safeParse(storeId).success)
    return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId, ["owner", "admin", "editor"]);
  if (!auth.ok) return auth.error;
  try {
    const input = mutation.parse(await request.json());
    if (input.kind === "saveSettings") {
      if (!["owner", "admin"].includes(auth.role))
        return NextResponse.json(
          { error: "当前角色无权修改店铺设置" },
          { status: 403 },
        );
      try {
        new Intl.DateTimeFormat("en", { timeZone: input.settings.timezone });
      } catch {
        return NextResponse.json({ error: "无效的店铺时区" }, { status: 400 });
      }
      const s = input.settings;
      const { error } = await auth.supabase
        .from("stores")
        .update({
          name: s.name,
          platform: s.platform,
          currency: s.currency,
          timezone: s.timezone,
          sales_target: s.salesTarget,
          margin_alert: s.marginAlert,
        })
        .eq("id", storeId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (input.kind === "saveProduct") {
      if (
        !uuid.safeParse(input.product.id).success ||
        input.product.skus.some((s) => !uuid.safeParse(s.id).success)
      )
        return NextResponse.json(
          { error: "商品或 SKU ID 无效" },
          { status: 400 },
        );
      const { data, error } = await auth.supabase.rpc("save_product", {
        p_store: storeId,
        p_product: input.product,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, id: data });
    }
    if (input.kind === "archiveProduct") {
      const { error } = await auth.supabase.rpc("archive_product", {
        p_store: storeId,
        p_product: input.productId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (input.kind === "saveDaily") {
      const { data, error } = await auth.supabase.rpc("save_daily_metric", {
        p_store: storeId,
        p_row: { ...input.row, originalDate: input.originalDate },
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, id: data });
    }
    const { data, error } = await auth.supabase.rpc("save_ad_metric", {
      p_store: storeId,
      p_row: { ...input.row, originalDate: input.originalDate },
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data });
  } catch (error) {
    return apiError(error, "保存失败");
  }
}
