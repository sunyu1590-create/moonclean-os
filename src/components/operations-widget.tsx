"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, ClipboardCheck, RefreshCw } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { type InventoryBalance, type OperationTask, operationsRequest } from "@/lib/operations";
export function OperationsWidget(){
  const {mode,activeStoreId,data}=useApp();
  const [tasks,setTasks]=useState<OperationTask[]>([]);const [balances,setBalances]=useState<InventoryBalance[]>([]);
  const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const load=useCallback(async()=>{
    if(mode==="local"){
      setError("");setTasks(data?.tasks||[]);setBalances(data?.inventory||[]);setLoading(false);return;
    }
    if(!activeStoreId)return;
    setLoading(true);setError("");
    try{
      const [taskResult,inventoryResult]=await Promise.all([
        operationsRequest<{tasks:OperationTask[]}>(activeStoreId,"tasks"),
        operationsRequest<{balances:InventoryBalance[]}>(activeStoreId,"inventory"),
      ]);
      setTasks(taskResult.tasks);setBalances(inventoryResult.balances);
    }catch(cause){setError(cause instanceof Error?cause.message:"运营提醒读取失败");}
    finally{setLoading(false);}
  },[activeStoreId,mode,data?.tasks,data?.inventory]);
  useEffect(()=>{queueMicrotask(()=>{setTasks([]);setBalances([]);void load();});},[load]);
  const today=data?new Intl.DateTimeFormat("en-CA",{timeZone:data.settings.store.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()):"";
  const due=tasks.filter(task=>task.status!=="done"&&task.due_date&&task.due_date<=today);
  const low=balances.filter(row=>row.quantity<=row.low_stock_threshold);
  return <SectionCard title="今日运营提醒" sub={mode==="local"?"当前设备的待办和库存预警":"待办截止日期与手工库存预警"} className="mt-5" action={<Button size="sm" variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>刷新</Button>}>
    {error&&<p role="alert" className="mb-3 text-sm text-[#e85d65]">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/tasks" className="flex items-center justify-between rounded-2xl border border-[#e8edf2] bg-[#fafcff] p-4 text-sm"><span className="flex items-center gap-3"><ClipboardCheck size={19} className="text-[#287fe2]"/>到期 / 逾期待办 <strong className="text-[#202936]">{due.length}</strong></span><ArrowUpRight size={16}/></Link>
      <Link href="/inventory" className="flex items-center justify-between rounded-2xl border border-[#e8edf2] bg-[#fafcff] p-4 text-sm"><span className="flex items-center gap-3"><Boxes size={19} className="text-[#287fe2]"/>低库存规格 <strong className="text-[#202936]">{low.length}</strong></span><ArrowUpRight size={16}/></Link>
    </div>
    <p className="mt-3 text-xs text-[#8999a9]">仅统计已设置库存的 SKU；模拟订单不会影响库存。</p>
  </SectionCard>;
}
