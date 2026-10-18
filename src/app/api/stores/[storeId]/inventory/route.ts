import { NextResponse } from "next/server";
import { z } from "zod";
import { inventorySchema } from "@/lib/operations";
import { requireStore, rejectCrossOriginMutation, apiError } from "@/lib/supabase/auth";
type Context = { params: Promise<{ storeId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId); if (!auth.ok) return auth.error;
  const [balances, movements] = await Promise.all([
    auth.supabase.from("inventory_balances").select("sku_id,quantity,low_stock_threshold,updated_at").eq("store_id",storeId),
    auth.supabase.from("inventory_movements").select("id,sku_id,quantity_before,quantity_after,delta,note,created_at").eq("store_id",storeId).order("created_at",{ascending:false}).limit(30),
  ]);
  if (balances.error || movements.error) return apiError(balances.error || movements.error, "库存读取失败");
  return NextResponse.json({ balances: balances.data, movements: movements.data });
}
export async function POST(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId,["owner","admin","editor"]); if (!auth.ok) return auth.error;
  try {
    const row = inventorySchema.parse(await request.json());
    const { error } = await auth.supabase.rpc("set_inventory_balance", {
      p_store: storeId, p_sku: row.skuId, p_quantity: row.quantity,
      p_threshold: row.threshold, p_note: row.note,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "库存保存失败"); }
}
