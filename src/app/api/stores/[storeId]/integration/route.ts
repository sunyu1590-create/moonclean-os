import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { requireStore, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
import { runMockSync } from "@/services/mock-sync";
import { money, orderSchema, refundSchema } from "@/integrations/pinduoduo/types";
import { refundReasonSchema } from "@/lib/after-sales";

const uuid = z.uuid();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect") }),
  z.object({ action: z.literal("sync"), connectionId: uuid, kind: z.enum(["orders","products","refunds"]), fault: z.enum(["timeout","rate_limit","token_expired","partial_batch"]).optional() }),
  z.object({ action: z.literal("retry"), connectionId: uuid, jobId: uuid }),
  z.object({ action: z.literal("auto"), connectionId: uuid, enabled: z.boolean() }),
  z.object({ action: z.literal("reset"), connectionId: uuid }),
  z.object({ action: z.literal("addOrder"), connectionId: uuid, order: orderSchema }),
  z.object({ action: z.literal("setOrderStatus"), connectionId: uuid, externalId: z.string().min(1), status: orderSchema.shape.status }),
  z.object({ action: z.literal("addRefund"), connectionId: uuid, refund: refundSchema }),
  z.object({ action: z.literal("setRefundStatus"), connectionId: uuid, externalId: z.string().min(1), status: refundSchema.shape.status }),
  z.object({ action: z.literal("setRefundIssue"), connectionId: uuid, externalId: z.string().min(1), reason: refundReasonSchema.nullable(), note: z.string().max(300) }),
  z.object({ action: z.literal("bindSku"), connectionId: uuid, externalSkuId: uuid, skuId: uuid }),
  z.object({ action: z.literal("unbindSku"), connectionId: uuid, externalSkuId: uuid }),
]);
export async function GET(_request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!uuid.safeParse(storeId).success) return NextResponse.json({error:"店铺 ID 无效"},{status:400});
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const db = auth.supabase;
  const [
    connections,jobs,logs,products,skus,mappings,history,internalSkus,
    orders,refunds,cursors,refundIssues,
  ] = await Promise.all([
    db.from("platform_connections").select("*").eq("store_id",storeId),
    db.from("sync_jobs").select("*").eq("store_id",storeId).order("started_at",{ascending:false}).limit(60),
    db.from("sync_logs").select("*").eq("store_id",storeId).order("created_at",{ascending:false}).limit(100),
    db.from("external_products").select("*").eq("store_id",storeId),
    db.from("external_skus").select("*").eq("store_id",storeId),
    db.from("platform_sku_mappings").select("*").eq("store_id",storeId),
    db.from("platform_sku_mapping_history").select("*").eq("store_id",storeId).order("created_at",{ascending:false}).limit(60),
    db.from("skus").select("id,sku_name,sku_code,product_id").eq("store_id",storeId).eq("status","active"),
    db.from("external_orders").select("id,external_id,status,placed_at,gross_sales,is_demo").eq("store_id",storeId).order("placed_at",{ascending:false}).limit(100),
    db.from("external_refunds").select("id,connection_id,external_id,order_id,amount,status").eq("store_id",storeId).limit(100),
    db.from("sync_cursors").select("connection_id,kind,cursor_value,updated_at").eq("store_id",storeId),
    db.from("mock_platform_events").select("external_id,payload").eq("store_id",storeId).eq("kind","refund"),
  ]);
  const results = {connections,jobs,logs,products,skus,mappings,history,internalSkus,orders,refunds,cursors,refundIssues};
  const problem = Object.values(results).find((r) => r.error);
  if (problem?.error) return apiError(problem.error);
  const issueById = new Map((refundIssues.data || []).map((row) => [row.external_id, row.payload as { reason?: string|null; note?: string } | null]));
  const response = Object.fromEntries(Object.entries(results).filter(([key])=>key!=="refundIssues").map(([key,value])=>[key,value.data]));
  response.refunds = (refunds.data || []).map((row) => ({...row, ...(issueById.get(row.external_id) || {})}));
  return NextResponse.json(response,{
    headers:{"Cache-Control":"no-store"},
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const crossOrigin=rejectCrossOriginMutation(request);
  if(crossOrigin)return crossOrigin;
  const { storeId } = await params;
  if (!uuid.safeParse(storeId).success) return NextResponse.json({error:"店铺 ID 无效"},{status:400});
  const auth = await requireStore(storeId,["owner","admin","editor"]);
  if(!auth.ok)return auth.error;
  try {
    const input=actionSchema.parse(await request.json());
    const db=auth.supabase;
    if(input.action==="connect"){
      if(!["owner","admin"].includes(auth.role)) return NextResponse.json({error:"需要管理员权限"},{status:403});
      const {data,error}=await db.rpc("create_mock_connection",{p_store:storeId});
      if(error)throw error;
      return NextResponse.json({connectionId:data});
    }
    const {data:connection,error:connectionError}=await db.from("platform_connections")
      .select("id,mode").eq("id",input.connectionId).eq("store_id",storeId).single();
    if(connectionError || connection?.mode!=="mock") return NextResponse.json({error:"模拟连接不存在"},{status:404});
    if(input.action==="sync" || input.action==="retry"){
      let kind = input.action==="sync" ? input.kind : null;
      if(input.action==="retry"){
        const {data:job,error}=await db.from("sync_jobs").select("kind,status").eq("id",input.jobId).eq("connection_id",input.connectionId).single();
        if(error || !job || !["failed","partial_success"].includes(job.status)) return NextResponse.json({error:"任务不可重试"},{status:400});
        kind=job.kind as "orders"|"products"|"refunds";
      }
      const result=await runMockSync(db,storeId,input.connectionId,kind!,input.action==="sync"?input.fault:undefined);
      return NextResponse.json(result);
    }
    if(input.action==="auto"){
      if(!["owner","admin"].includes(auth.role))return NextResponse.json({error:"需要管理员权限"},{status:403});
      const {error}=await db.from("platform_connections").update({auto_sync:input.enabled}).eq("id",input.connectionId).eq("store_id",storeId);
      if(error)throw error;
    } else if(input.action==="reset"){
      if(!["owner","admin"].includes(auth.role))return NextResponse.json({error:"需要管理员权限"},{status:403});
      const {error}=await db.rpc("reset_mock_connection",{p_store:storeId,p_connection:input.connectionId});
      if(error)throw error;
    } else if(input.action==="setRefundIssue"){
      const {data:refund,error:refundError}=await db.from("external_refunds").select("order_id,amount,status").eq("connection_id",input.connectionId).eq("external_id",input.externalId).maybeSingle();
      if(refundError)throw refundError;
      if(!refund)return NextResponse.json({error:"请先同步这条退款记录"},{status:404});
      const {data:order,error:orderError}=await db.from("external_orders").select("external_id").eq("id",refund.order_id).eq("store_id",storeId).maybeSingle();
      if(orderError)throw orderError;
      const {data:previous,error:previousError}=await db.from("mock_platform_events").select("payload").eq("connection_id",input.connectionId).eq("kind","refund").eq("external_id",input.externalId).maybeSingle();
      if(previousError)throw previousError;
      const previousPayload = previous?.payload && typeof previous.payload === "object" && !Array.isArray(previous.payload) ? previous.payload as Record<string,unknown> : {};
      const payload={...previousPayload,externalId:input.externalId,orderExternalId:order?.external_id||"unknown",amount:refund.amount,status:refund.status,reason:input.reason,note:input.note};
      const {error}=await db.from("mock_platform_events").upsert({store_id:storeId,connection_id:input.connectionId,kind:"refund",external_id:input.externalId,payload,updated_at:new Date().toISOString()},{onConflict:"connection_id,kind,external_id"});
      if(error)throw error;
    } else if(input.action==="addOrder" || input.action==="setOrderStatus" || input.action==="addRefund" || input.action==="setRefundStatus"){
      const kind=input.action==="addRefund"||input.action==="setRefundStatus"?"refund":"order";
      const id=input.action==="addOrder"?input.order.externalId:input.action==="addRefund"?input.refund.externalId:input.externalId;
      let payload:unknown=input.action==="addOrder"?input.order:input.action==="addRefund"?input.refund:{status:input.status};
      if(input.action==="setOrderStatus" || input.action==="setRefundStatus"){
        const table=input.action==="setOrderStatus"?"external_orders":"external_refunds";
        const {data:existing,error:existingError}=await db.from(table).select("id").eq("connection_id",input.connectionId).eq("external_id",id).maybeSingle();
        if(existingError)throw existingError;
        if(!existing)return NextResponse.json({error:"请先同步该模拟记录"},{status:404});
        const {data:previous,error:readError}=await db.from("mock_platform_events")
          .select("payload").eq("connection_id",input.connectionId).eq("kind",kind).eq("external_id",id).maybeSingle();
        if(readError)throw readError;
        if(previous?.payload&&typeof previous.payload==="object"&&!Array.isArray(previous.payload))
          payload={...previous.payload,status:input.status};
      }
      if(input.action==="addRefund"){
        if(!money.safeParse(input.refund.amount).success)throw new Error("退款金额无效");
        const {data:order,error:orderError}=await db.from("external_orders").select("gross_sales").eq("connection_id",input.connectionId).eq("external_id",input.refund.orderExternalId).maybeSingle();
        if(orderError)throw orderError;
        if(!order)return NextResponse.json({error:"请先同步对应的模拟订单"},{status:404});
        if(new Decimal(input.refund.amount).gt(order.gross_sales))return NextResponse.json({error:"退款金额不能超过订单销售额"},{status:400});
      }
      const {error}=await db.from("mock_platform_events").upsert({
        store_id:storeId,connection_id:input.connectionId,kind,external_id:id,payload,updated_at:new Date().toISOString(),
      },{onConflict:"connection_id,kind,external_id"});
      if(error)throw error;
    } else if(input.action==="bindSku"){
      const {data:external,error}=await db.from("external_skus").select("id").eq("id",input.externalSkuId).eq("connection_id",input.connectionId).single();
      if(error || !external)return NextResponse.json({error:"平台 SKU 不属于该连接"},{status:403});
      const {error:writeError}=await db.from("platform_sku_mappings").upsert({
        store_id:storeId,connection_id:input.connectionId,external_sku_id:input.externalSkuId,sku_id:input.skuId,match_kind:"manual",
      },{onConflict:"connection_id,external_sku_id"});
      if(writeError)throw writeError;
    } else {
      const {error}=await db.from("platform_sku_mappings").delete().eq("connection_id",input.connectionId).eq("external_sku_id",input.externalSkuId);
      if(error)throw error;
    }
    return NextResponse.json({ok:true});
  } catch(cause){return apiError(cause);}
}
