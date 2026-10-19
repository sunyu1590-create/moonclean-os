"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, ShoppingBag } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { downloadText, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { operationsRequest } from "@/lib/operations";
import { AiInsightPanel } from "@/components/ai-insight-panel";
type Order={id:string;external_id:string;status:string;placed_at:string;gross_sales:string;is_demo:boolean};
type Item={order_id:string;external_sku_id:string;quantity:number;gross_sales:string};
type Refund={order_id:string;external_id:string;amount:string;status:string};
type Snapshot={orders:Order[];items:Item[];refunds:Refund[];count:number;page:number};
const statusName:Record<string,string>={paid:"已付款",shipped:"已发货",completed:"已完成",refunded:"已退款",cancelled:"已取消"};
export default function OrdersPage(){
  const {mode,activeStoreId}=useApp();
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);const [page,setPage]=useState(1);
  const [status,setStatus]=useState("all");const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const load=useCallback(async()=>{
    if(mode==="local"){setSnapshot(null);setError("");setLoading(false);return;}
    if(!activeStoreId)return;
    setLoading(true);setError("");
    try{setSnapshot(await operationsRequest<Snapshot>(activeStoreId,`orders?page=${page}&status=${status}`));}
    catch(cause){setError(cause instanceof Error?cause.message:"订单读取失败");}
    finally{setLoading(false);}
  },[activeStoreId,page,status,mode]);
  useEffect(()=>{queueMicrotask(()=>{setSnapshot(null);void load();});},[load]);
  const visible=useMemo(()=>snapshot?.orders.filter(order=>order.external_id.toLowerCase().includes(search.trim().toLowerCase()))||[],[snapshot,search]);
  function exportPage(){
    if(!snapshot)return;
    const cell=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`;
    const rows=["订单号,状态,下单时间,成交额,退款成功金额,数据来源",...visible.map(order=>{
      const refunded=snapshot.refunds.filter(refund=>refund.order_id===order.id&&refund.status==="succeeded").reduce((sum,refund)=>sum+Number(refund.amount),0);
      return [order.external_id,statusName[order.status]||order.status,order.placed_at,order.gross_sales,refunded.toFixed(2),order.is_demo?"模拟数据":"平台数据"].map(cell).join(",");
    })];
    downloadText(`moonclean-orders-page-${page}.csv`,`\uFEFF${rows.join("\n")}`,"text/csv;charset=utf-8");
  }
  if(mode==="local")return <><PageHead eyebrow="ORDERS / 订单中心" title="订单进展，一处查看" description="当前本地工作区不保存平台同步订单。"/><AiInsightPanel feature="orders" context={{ orderCount: 0, refundCount: 0 }}/><div className="rounded-2xl border border-[#cfe5f8] bg-[#e8f5ff] p-5 text-sm leading-6 text-[#476d91]">订单和退款来自平台连接中心，当前设备没有本地订单记录。切换到云端数据后可读取已同步的模拟订单；本地经营日报仍可在数据中心管理。</div></>;
  return <>
    <PageHead eyebrow="ORDERS / 订单中心" title="订单进展，一处查看" description="查看平台同步的订单、商品明细和退款。当前拼多多连接为模拟模式，所有订单均为模拟数据。" action={<div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading||mode!=="cloud"}><RefreshCw size={16}/>刷新</Button><Button variant="outline" onClick={exportPage} disabled={!visible.length}><Download size={16}/>导出本页</Button></div>}/>
    <AiInsightPanel feature="orders" context={{ totalOrders: snapshot?.count || 0, loadedOrders: snapshot?.orders.length || 0, paidOrders: (snapshot?.orders || []).filter(order=>order.status==="paid").length, shippedOrders: (snapshot?.orders || []).filter(order=>order.status==="shipped").length, completedOrders: (snapshot?.orders || []).filter(order=>order.status==="completed").length, refundedOrders: (snapshot?.orders || []).filter(order=>order.status==="refunded").length, cancelledOrders: (snapshot?.orders || []).filter(order=>order.status==="cancelled").length, otherStatusOrders: (snapshot?.orders || []).filter(order=>!Object.hasOwn(statusName,order.status)).length, grossSales: (snapshot?.orders || []).reduce((sum, order)=>sum+Number(order.gross_sales),0), refundCount: snapshot?.refunds.length || 0, pendingRefunds: (snapshot?.refunds || []).filter(refund=>refund.status==="pending").length }} />
    <div className="mb-5 rounded-2xl border border-[#cfe5f8] bg-[#e8f5ff] p-4 text-sm text-[#476d91]">此页面的模拟订单不会自动计入经营总览或扣减库存。真实经营数据请在数据中心录入。<Link href="/integrations" className="ml-2 font-semibold text-[#287fe2] underline">前往平台连接</Link></div>
    {mode!=="cloud"&&<p className="mb-5 rounded-2xl bg-white p-4 text-sm text-[#8194a8]">订单中心使用云端同步数据，配置 Supabase 并登录后可使用。</p>}
    {error&&<p role="alert" className="mb-5 rounded-xl bg-[#fff0f1] p-4 text-sm text-[#d35760]">{error}</p>}
    <SectionCard title="订单记录" sub={snapshot?`共 ${snapshot.count} 笔，当前第 ${page} 页，每页 20 笔`:"正在读取云端订单"} action={<div className="flex flex-wrap gap-2"><input aria-label="筛选本页订单号" value={search} onChange={e=>setSearch(e.target.value)} placeholder="筛选本页订单号" className="h-9 w-40 rounded-xl border border-[#e3eaf1] px-3 text-xs"/><AppSelect aria-label="筛选订单状态" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} className="h-9 rounded-xl border border-[#e3eaf1] bg-white px-3 text-xs"><option value="all">全部状态</option>{Object.entries(statusName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AppSelect></div>}>
      {loading?<TableSkeleton rows={5} columns={4}/>:!visible.length?<p className="text-sm text-[#8194a8]">本页暂无订单。可在平台连接中心创建模拟订单并同步。</p>:<div className="space-y-3">{visible.map(order=>{
        const items=snapshot?.items.filter(item=>item.order_id===order.id)||[];
        const refunds=snapshot?.refunds.filter(refund=>refund.order_id===order.id)||[];
        return <div key={order.id} className="rounded-2xl border border-[#e9eef3] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ShoppingBag size={16} className="text-[#287fe2]"/><strong className="break-all text-sm text-[#26374c]">{order.external_id}</strong><span className="rounded-full bg-[#e8f5ff] px-2 py-0.5 text-[11px] font-semibold text-[#287fe2]">{order.is_demo?"模拟数据":"平台数据"}</span></div><p className="mt-2 text-xs text-[#8194a8]">{new Date(order.placed_at).toLocaleString("zh-CN")} · {statusName[order.status]||order.status}</p></div><div className="text-lg font-bold text-[#202936]">¥{Number(order.gross_sales).toFixed(2)}</div></div>
          {items.length>0&&<div className="mt-3 border-t border-[#eef1f4] pt-3 text-xs text-[#6b7d8f]">{items.map(item=><span key={item.external_sku_id} className="mr-4 inline-block">{item.external_sku_id} × {item.quantity} · ¥{Number(item.gross_sales).toFixed(2)}</span>)}</div>}
          {refunds.length>0&&<div className="mt-2 text-xs text-[#e85d65]">退款：{refunds.map(refund=>`${refund.external_id} ¥${Number(refund.amount).toFixed(2)}（${refund.status==="succeeded"?"成功":refund.status==="pending"?"处理中":"已驳回"}）`).join("；")}</div>}
        </div>;
      })}</div>}
      {snapshot&&snapshot.count>20&&<div className="mt-5 flex items-center justify-end gap-3"><Button size="sm" variant="outline" disabled={loading||page<=1} onClick={()=>setPage(page-1)}>上一页</Button><span className="text-xs text-[#8194a8]">{page} / {Math.ceil(snapshot.count/20)}</span><Button size="sm" variant="outline" disabled={loading||page>=Math.ceil(snapshot.count/20)} onClick={()=>setPage(page+1)}>下一页</Button></div>}
    </SectionCard>
  </>;
}
