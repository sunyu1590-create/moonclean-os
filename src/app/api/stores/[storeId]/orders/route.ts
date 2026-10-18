import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStore, apiError } from "@/lib/supabase/auth";
export async function GET(request: Request, {params}:{params:Promise<{storeId:string}>}) {
  const {storeId}=await params;
  if(!z.uuid().safeParse(storeId).success)return NextResponse.json({error:"店铺 ID 无效"},{status:400});
  const auth=await requireStore(storeId);if(!auth.ok)return auth.error;
  const search=new URL(request.url).searchParams;
  const page=Math.min(1000,Math.max(1,Number(search.get("page"))||1));
  const status=search.get("status")||"all";
  if(!["all","paid","shipped","completed","refunded","cancelled"].includes(status))return NextResponse.json({error:"订单状态无效"},{status:400});
  let query=auth.supabase.from("external_orders")
    .select("id,external_id,status,placed_at,gross_sales,is_demo",{count:"exact"})
    .eq("store_id",storeId).order("placed_at",{ascending:false}).range((page-1)*20,page*20-1);
  if(status!=="all")query=query.eq("status",status);
  const {data,error,count}=await query;
  if(error)return apiError(error,"订单读取失败");
  const ids=(data||[]).map(order=>order.id);
  if(!ids.length)return NextResponse.json({orders:[],items:[],refunds:[],count:count||0,page});
  const [items,refunds]=await Promise.all([
    auth.supabase.from("external_order_items").select("order_id,external_sku_id,quantity,gross_sales").eq("store_id",storeId).in("order_id",ids),
    auth.supabase.from("external_refunds").select("order_id,external_id,amount,status").eq("store_id",storeId).in("order_id",ids),
  ]);
  if(items.error||refunds.error)return apiError(items.error||refunds.error,"订单明细读取失败");
  return NextResponse.json({orders:data,items:items.data,refunds:refunds.data,count:count||0,page});
}
