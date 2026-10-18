"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { getIntegration, integrationAction, type IntegrationSnapshot } from "@/integrations/pinduoduo/client";

const kindLabel = {orders:"订单",products:"商品",refunds:"退款"};
const statusLabel:Record<string,string>={pending:"等待中",running:"运行中",success:"成功",partial_success:"部分成功",failed:"失败",cancelled:"已取消"};
export default function SyncCenter(){
  const {activeStoreId,role,retry}=useApp();
  const [data,setData]=useState<IntegrationSnapshot|null>(null);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("all");
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{if(activeStoreId)setData(await getIntegration(activeStoreId));},[activeStoreId]);
  useEffect(()=>{queueMicrotask(()=>{void refresh().catch(e=>setError(e.message));});},[refresh]);
  const connection=data?.connections.find(c=>c.mode==="mock");
  const canEdit=role!=="viewer";
  async function act(body:unknown){
    if(!activeStoreId)return;
    setBusy(true);setError("");
    try{const result=await integrationAction<{status?:string;error?:string}>(activeStoreId,body);
      if(result.status==="failed"||result.status==="partial_success")setError(result.error||"同步未全部完成");
      await refresh();await retry();
    }catch(e){setError(e instanceof Error?e.message:"同步失败");}
    finally{setBusy(false);}
  }
  const jobs=(data?.jobs||[]).filter(job=>filter==="all"||job.kind===filter);
  return <>
    <PageHead eyebrow="SYNC CENTER / 同步任务" title="同步任务中心"
      description="模拟平台任务在服务端执行，进度、游标和错误持久保存在云端。" />
    <div className="mb-5 rounded-2xl border border-[#cfe5f8] bg-[#e8f5ff] p-4 text-sm text-[#476d91]">
      这里的订单、商品和退款全部来自 Mock Adapter；尚未向拼多多官方接口发送请求。
    </div>
    {error&&<div role="alert" className="mb-5 rounded-xl bg-[#fff0f1] p-4 text-sm text-[#d35760]">{error}</div>}
    {!connection?<SectionCard title="尚未建立模拟连接" sub="先到平台连接中心添加连接或创建模拟店铺"><Link href="/integrations" className="text-sm font-semibold text-[#3b91eb]">前往平台连接中心 <ArrowRight className="inline size-4"/></Link></SectionCard>:
    <div className="space-y-5">
      <SectionCard title="立即同步" sub={connection.display_name+" · 演示数据"}>
        <div className="flex flex-wrap gap-2">
          {(["products","orders","refunds"] as const).map(kind=><Button key={kind} disabled={busy||!canEdit} onClick={()=>void act({action:"sync",connectionId:connection.id,kind})}>
            <RefreshCw size={15}/>同步{kindLabel[kind]}
          </Button>)}
        </div>
        <p className="mt-3 text-xs text-[#8a9eb0]">第一次建议按“商品 → 订单 → 退款”顺序运行。后续相同任务只读取增量。</p>
      </SectionCard>
      <SectionCard title="历史任务" sub="刷新页面后仍保留；失败可从已提交游标继续">
        <div className="mb-4 flex flex-wrap gap-2">{["all","orders","products","refunds"].map(kind=><Button key={kind} size="sm" variant={filter===kind?"default":"outline"} onClick={()=>setFilter(kind)}>{kind==="all"?"全部":kindLabel[kind as keyof typeof kindLabel]}</Button>)}</div>
        {!jobs.length?<p className="py-8 text-center text-sm text-[#8a9eb0]">暂无同步任务</p>:
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-[#8fa1b3]"><tr>
            <th className="py-2">开始时间</th><th>类型</th><th>状态</th><th>成功</th><th>失败</th><th>错误详情</th><th>操作</th>
          </tr></thead><tbody>{jobs.map(job=><tr key={job.id} className="border-b border-[#edf2f7]">
            <td className="py-3">{new Date(job.started_at).toLocaleString("zh-CN")}</td>
            <td>{kindLabel[job.kind]}</td><td>{statusLabel[job.status]}</td><td>{job.success_count}</td><td>{job.failure_count}</td>
            <td className="max-w-[240px] break-words text-xs text-[#d35760]">{job.error_summary||"—"}</td>
            <td>{["failed","partial_success"].includes(job.status)&&canEdit&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void act({action:"retry",connectionId:job.connection_id,jobId:job.id})}>重试</Button>}</td>
          </tr>)}</tbody></table></div>}
      </SectionCard>
      <SectionCard title="同步日志" sub="最近 100 条">{!data?.logs.length?<p className="text-sm text-[#8a9eb0]">暂无日志</p>:
        <div className="max-h-72 space-y-2 overflow-auto text-xs">{data.logs.map(log=><div key={log.id} className="flex gap-3 border-b py-2">
          <span className="shrink-0 text-[#9aabba]">{new Date(log.created_at).toLocaleString("zh-CN")}</span>
          <span className={log.level==="error"?"text-[#d35760]":"text-[#47617a]"}>{log.message}</span>
        </div>)}</div>}</SectionCard>
    </div>}
  </>;
}
