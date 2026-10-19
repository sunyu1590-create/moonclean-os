"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, CheckCircle2, ClipboardCheck, Clock3, RefreshCw } from "lucide-react";
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
  const visibleTasks = mode === "local" ? data?.tasks || [] : tasks;
  const due=visibleTasks.filter(task=>task.status!=="done"&&task.due_date&&task.due_date<=today);
  const taskPreview = [...visibleTasks].sort((a,b)=>{
    if((a.status==="done") !== (b.status==="done")) return a.status==="done"?1:-1;
    if(a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if(a.due_date) return -1;
    if(b.due_date) return 1;
    return b.created_at.localeCompare(a.created_at);
  }).slice(0,4);
  const low=balances.filter(row=>row.quantity<=row.low_stock_threshold);
  return <SectionCard title="今日运营提醒" sub={mode==="local"?"当前设备的待办和库存预警":"待办截止日期与手工库存预警"} className="mt-5" action={<Button size="sm" variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>刷新</Button>}>
    {error&&<p role="alert" className="mb-3 text-sm text-[var(--mc-color-danger)]">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/tasks" className="flex items-center justify-between rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4 text-sm"><span className="flex items-center gap-3"><ClipboardCheck size={19} className="text-primary"/>未完成待办 <strong className="text-foreground">{visibleTasks.filter(task=>task.status!=="done").length}</strong></span><ArrowUpRight size={16}/></Link>
      <Link href="/inventory" className="flex items-center justify-between rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4 text-sm"><span className="flex items-center gap-3"><Boxes size={19} className="text-primary"/>低库存规格 <strong className="text-foreground">{low.length}</strong></span><ArrowUpRight size={16}/></Link>
    </div>
    <div className="mt-4 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h3 className="text-sm font-semibold text-foreground">运营待办</h3><p className="mt-0.5 text-[11px] text-muted-foreground">创建后会自动出现在这里</p></div><Link href="/tasks" className="text-xs font-semibold text-primary">{visibleTasks.length?"管理任务":"创建任务"} →</Link></div>
      {loading && mode === "cloud" ? <p className="px-4 py-5 text-sm text-muted-foreground">正在同步云端待办…</p> : taskPreview.length ? <div className="divide-y divide-[#f2f4f7]">{taskPreview.map(task=>{
        const overdue=task.status!=="done"&&!!task.due_date&&task.due_date<today;
        return <Link href="/tasks" key={task.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--mc-tint-blue)]">
          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${task.status==="done"?"bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]":overdue?"bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]":"bg-[var(--mc-tint-blue)] text-primary"}`}>{task.status==="done"?<CheckCircle2 size={16}/>:<Clock3 size={16}/>}</span>
          <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-medium ${task.status==="done"?"text-muted-foreground line-through":"text-foreground"}`}>{task.title}</span><span className={`mt-0.5 block text-[11px] ${overdue?"text-[var(--mc-color-danger)]":"text-muted-foreground"}`}>{task.status==="done"?"已完成":overdue?`已逾期 · 截止 ${task.due_date}`:task.due_date?`截止 ${task.due_date}`:task.status==="doing"?"处理中 · 无截止日期":"待处理 · 无截止日期"}</span></span>
          <ArrowUpRight size={15} className="shrink-0 text-muted-foreground"/>
        </Link>;
      })}</div> : <div className="px-4 py-5 text-center"><p className="text-sm text-muted-foreground">还没有运营待办</p><Link href="/tasks" className="mt-1 inline-block text-xs font-semibold text-primary">新建第一条任务</Link></div>}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">到期 / 逾期待办 {due.length} 项 · 仅统计已设置库存的 SKU，模拟订单不会影响库存。</p>
  </SectionCard>;
}
