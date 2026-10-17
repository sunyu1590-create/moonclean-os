import { NextResponse } from "next/server";
import { skuDailySchema } from "@/lib/sku-daily";
import { requireStore, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
export async function POST(request:Request,{params}:{params:Promise<{storeId:string}>}){
  const crossOrigin=rejectCrossOriginMutation(request);if(crossOrigin)return crossOrigin;
  const {storeId}=await params;const auth=await requireStore(storeId,["owner","admin","editor"]);if(!auth.ok)return auth.error;
  try{const row=skuDailySchema.parse(await request.json());const {data,error}=await auth.supabase.rpc("save_sku_daily_metric",{p_store:storeId,p_row:row});if(error)throw error;return NextResponse.json({ok:true,id:data});}catch(error){return apiError(error,"SKU 日销量保存失败");}
}
