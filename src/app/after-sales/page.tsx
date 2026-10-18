"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Decimal from "decimal.js";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { getIntegration, type IntegrationSnapshot } from "@/integrations/pinduoduo/client";
import { formatMoney } from "@/lib/finance";
export default function AfterSalesPage(){
  const {activeStoreId,mode}=useApp();const [snapshot,setSnapshot]=useState<IntegrationSnapshot|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const load=useCallback(async()=>{if(!activeStoreId)return;setLoading(true);setError("");try{setSnapshot(await getIntegration(activeStoreId));}catch(e){setError(e instanceof Error?e.message:"售后读取失败");}finally{setLoading(false);}},[activeStoreId]);
  useEffect(()=>{queueMicrotask(()=>{setSnapshot(null);void load();});},[load]);
  const refunds=snapshot?.refunds||[];const orders=snapshot?.orders||[];
  const orderById=new Map(orders.map(order=>[order.id,order]));
  const completed=refunds.filter(row=>row.status==="succeeded");const pending=refunds.filter(row=>row.status==="pending");
  const completedAmount=completed.reduce((sum,row)=>sum.plus(row.amount),new Decimal(0));
  const totalSales=orders.reduce((sum,row)=>sum.plus(row.gross_sales),new Decimal(0));
  const ratio=totalSales.gt(0)?completedAmount.div(totalSales).mul(100).toNumber():null;
  const sorted=[...refunds].sort((a,b)=>Number(orderById.get(b.order_id)?.placed_at||0)-Number(orderById.get(a.order_id)?.placed_at||0));
  return <>
    <PageHead eyebrow="AFTER-SALES / 售后分析" title="退款状态和售后金额，一眼看清" description="按同步到云端的退款记录汇总。退款原因当前未从平台接口提供，接入真实售后接口后可继续扩展。" action={<Button variant="outline" onClick={()=>void load()} disabled={loading||mode!=="cloud"}><RefreshCw size={16}/>刷新</Button>}/>
    {mode!=="cloud"&&<p className="mb-5 rounded-2xl bg-[#e8f5ff] p-4 text-sm text-[#476d91]">售后分析使用店铺订单和退款同步数据，请登录云端店铺查看。</p>}
    {error&&<p role="alert" className="mb-5 rounded-xl bg-[#fff0f1] p-4 text-sm text-[#d35760]">{error}</p>}
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="退款记录" value={String(refunds.length)} icon={<AlertCircle size={19}/>}/><MetricCard label="处理中" value={String(pending.length)} tone={pending.length?"red":"green"} icon={<Clock3 size={19}/>}/><MetricCard label="成功退款金额" value={formatMoney(completedAmount.toFixed(2))} tone="red" icon={<CheckCircle2 size={19}/>}/><MetricCard label="成功退款 / 同期同步订单额" value={ratio===null?"无法计算":`${ratio.toFixed(2)}%`} sub="仅按当前已同步订单计算"/></div>
    <SectionCard title="售后退款记录" sub={snapshot?`当前展示 ${refunds.length} 条同步退款`:"正在读取云端退款"}>
      {loading?<p className="text-sm text-[#8194a8]">正在加载售后数据…</p>:!sorted.length?<div className="text-sm text-[#8194a8]">暂无退款记录。可在平台连接中心同步退款。<Link className="ml-2 text-[#287fe2] underline" href="/integrations">前往平台连接</Link></div>:<div className="space-y-2">{sorted.map(refund=>{const order=orderById.get(refund.order_id);const state=refund.status==="succeeded"?"退款成功":refund.status==="pending"?"处理中":"已驳回";return <div key={refund.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e9eef3] p-4"><div><strong className="text-sm text-[#26374c]">{refund.external_id}</strong><p className="mt-1 text-xs text-[#8a99a9]">订单 {order?.external_id||"未同步"} · {state}{order?.is_demo&&<span className="ml-2 text-[#3b91eb]">模拟数据</span>}</p></div><strong className={refund.status==="succeeded"?"text-[#e85d65]":"text-[#5d7187]"}>{formatMoney(refund.amount)}</strong></div>;})}</div>}
    </SectionCard>
    <p className="mt-4 text-xs text-[#8b9aaa]">当前平台连接为模拟模式时，退款记录也为模拟数据。售后明细暂按 100 条展示；订单总额范围取最近同步的 100 笔订单。</p>
  </>;
}
