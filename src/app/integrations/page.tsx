"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Link2, Plus, RotateCcw, AlertTriangle } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getIntegration, integrationAction, type IntegrationSnapshot } from "@/integrations/pinduoduo/client";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { notifyFeedback } from "@/lib/feedback";

export default function IntegrationsPage(){
  const {activeStoreId,role,retry,data,mode}=useApp();
  const [snapshot,setSnapshot]=useState<IntegrationSnapshot|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [fault,setFault]=useState("");
  const [refundOrder,setRefundOrder]=useState("");
  const [refundAmount,setRefundAmount]=useState("10.00");
  const [refundToUpdate,setRefundToUpdate]=useState("");
  const [refundStatus,setRefundStatus]=useState("succeeded");
  const [orderToUpdate,setOrderToUpdate]=useState("");
  const [orderStatus,setOrderStatus]=useState("completed");
  const refresh=useCallback(async()=>{if(mode==="local"){setSnapshot(null);return;}if(activeStoreId)setSnapshot(await getIntegration(activeStoreId));},[activeStoreId,mode]);
  useEffect(()=>{queueMicrotask(()=>{void refresh().catch(e=>setError(e.message));});},[refresh]);
  const connection=snapshot?.connections.find(c=>c.mode==="mock");
  const canEdit=role!=="viewer";
  const canAdmin=role==="owner"||role==="admin";
  async function act(body:unknown){
    if(mode==="local")return;
    if(!activeStoreId)return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await integrationAction<{status?:string;count?:number;error?:string}>(activeStoreId,body);
      await refresh();await retry();
      if(result.status && result.status!=="success")setError(`模拟同步${result.status==="partial_success"?"部分完成":"失败"}：${result.error||"请查看同步任务中心"}`);
      else setNotice(result.status?`模拟同步完成，本次处理 ${result.count||0} 条。`:"操作已保存至云端。");
    }
    catch(e){setError(e instanceof Error?e.message:"操作失败");}
    finally{setBusy(false);}
  }
  async function createDemo(){
    if(mode==="local")return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/integrations/demo",{method:"POST",credentials:"same-origin"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"创建模拟店铺失败");
      localStorage.setItem("moonclean-active-store",body.storeId);
      await retry();
      notifyFeedback({ kind: "success", title: "演示店铺已创建", description: "已切换到新店铺的云端工作区。" });
    }catch(e){const message=e instanceof Error?e.message:"创建失败";setError(message);notifyFeedback({ kind: "error", title: "创建演示店铺失败", description: message });}
    finally{setBusy(false);}
  }
  const internalNames=new Map(data?.products.flatMap(p=>p.skus.map(s=>[s.id,`${p.name} · ${s.name}`] as const))||[]);
  if(mode==="local")return <><PageHead eyebrow="INTEGRATIONS / 平台连接" title="平台连接中心" description="平台授权与定时同步属于云端功能。"/><AiInsightPanel feature="integrations" context={{ connectionCount: 0 }}/><div className="rounded-2xl border border-[#cfe5f8] bg-[#e8f5ff] p-5 text-sm leading-6 text-[#476d91]">当前正在使用本地数据。切换到云端数据后，才能管理平台连接、查看同步任务或运行模拟同步。切换不会上传本地数据。</div></>;
  return <>
    <PageHead eyebrow="INTEGRATIONS / 平台连接" title="平台连接中心"
      description="当前为模拟同步模式，尚未连接拼多多官方开放平台。" />
    <AiInsightPanel feature="integrations" context={{ connectionCount: snapshot?.connections.length || 0, connected: Boolean(connection), autoSync: Boolean(connection?.auto_sync), hasRecentSync: Boolean(connection?.last_result), jobCount: snapshot?.jobs.length || 0, failedJobs: (snapshot?.jobs || []).filter(job=>job.status==="failed"||job.status==="partial_success").length }} />
    <div className="mb-5 rounded-2xl border border-[#cfe5f8] bg-[#e8f5ff] p-4 text-sm text-[#476d91]">
      所有模拟订单、销售额与退款均为演示数据，不代表真实店铺业绩。官方接入状态：等待拼多多开放平台资质及应用授权。
    </div>
    {error&&<div role="alert" className="mb-5 rounded-xl bg-[#fff0f1] p-4 text-sm text-[#d35760]">{error}</div>}
    {notice&&<div role="status" className="mb-5 rounded-xl bg-[#e7f8f4] p-4 text-sm text-[#167c68]">{notice}</div>}
    {!connection?<SectionCard title="建立模拟连接" sub="不用提供拼多多账号或密钥">
      <div className="flex flex-wrap gap-3">
        {canAdmin&&data?.settings.store.platform==="pinduoduo"&&<Button disabled={busy} onClick={()=>void act({action:"connect"})}><Link2 size={16}/>为当前店铺添加模拟连接</Button>}
        <Button variant="outline" disabled={busy} onClick={()=>void createDemo()}><Plus size={16}/>创建独立模拟店铺</Button>
      </div>
    </SectionCard>:<div className="space-y-5">
      <SectionCard title={connection.display_name} sub="拼多多 · Mock Adapter · 未连接官方平台"
        action={<span className="rounded-full bg-[#e8f5ff] px-3 py-1 text-xs font-semibold text-[#3b91eb]">演示模式</span>}>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>授权状态：<strong>模拟连接，无官方授权</strong></div>
          <div>接口能力：模拟订单、商品、退款</div>
          <div>最近同步：{connection.last_synced_at?new Date(connection.last_synced_at).toLocaleString("zh-CN"):"尚未同步"}</div>
          <div>最近结果：{connection.last_result||"无"}</div>
          <div>后台定时同步：{connection.auto_sync?"已请求启用（需部署调度）":"未启用"}</div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["products","orders","refunds"] as const).map(kind=><Button key={kind} disabled={busy||!canEdit} onClick={()=>void act({action:"sync",connectionId:connection.id,kind,fault:fault||undefined})}>
            <RefreshCw size={15}/>同步{kind==="products"?"商品":kind==="orders"?"订单":"退款"}
          </Button>)}
          {canAdmin&&<Button variant="outline" disabled={busy} onClick={()=>void act({action:"auto",connectionId:connection.id,enabled:!connection.auto_sync})}>
            {connection.auto_sync?"关闭":"开启"}自动同步
          </Button>}
        </div>
        <div className="mt-4 flex items-center gap-3 text-xs text-[#8194a8]">
          <span>故障模拟：</span><AppSelect aria-label="故障模拟" className="rounded-lg border bg-white p-2" value={fault} onChange={e=>setFault(e.target.value)}>
            <option value="">正常</option><option value="timeout">网络超时</option><option value="rate_limit">限流</option>
            <option value="token_expired">令牌过期</option><option value="partial_batch">第二批次失败</option>
          </AppSelect>
        </div>
      </SectionCard>
      <SectionCard title="模拟平台操作" sub="先修改模拟平台源数据，再点击对应同步按钮">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy||!canEdit} onClick={()=>void act({action:"addOrder",connectionId:connection.id,order:{
            externalId:`mock-order-user-${crypto.randomUUID()}`,status:"paid",placedAt:new Date().toISOString(),
            updatedAt:new Date().toISOString(),grossSales:"39.90",items:[{externalSkuId:"mock-sku-2",quantity:1,grossSales:"39.90"}],
          }})}><Plus size={15}/>新增模拟订单 ¥39.90</Button>
          <AppSelect aria-label="选择模拟订单" value={orderToUpdate} onChange={e=>setOrderToUpdate(e.target.value)} className="rounded-lg border bg-white p-2 text-sm">
            <option value="">选择订单</option>{snapshot?.orders.map(o=><option key={o.id} value={o.external_id}>{o.external_id}</option>)}
          </AppSelect>
          <AppSelect aria-label="订单状态" value={orderStatus} onChange={e=>setOrderStatus(e.target.value)} className="rounded-lg border bg-white p-2 text-sm">
            <option value="paid">已付款</option><option value="shipped">已发货</option><option value="completed">已完成</option>
            <option value="refunded">已退款</option><option value="cancelled">已取消</option>
          </AppSelect>
          <Button variant="outline" disabled={busy||!canEdit||!orderToUpdate} onClick={()=>void act({action:"setOrderStatus",connectionId:connection.id,externalId:orderToUpdate,status:orderStatus})}>更新模拟订单状态</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AppSelect aria-label="退款订单" value={refundOrder} onChange={e=>setRefundOrder(e.target.value)} className="rounded-lg border bg-white p-2 text-sm">
            <option value="">选择退款订单</option>{snapshot?.orders.map(o=><option key={o.id} value={o.external_id}>{o.external_id}</option>)}
          </AppSelect>
          <Input className="w-28" aria-label="退款金额" value={refundAmount} onChange={e=>setRefundAmount(e.target.value)}/>
          <Button variant="outline" disabled={busy||!canEdit||!refundOrder||!/^\d+(\.\d{1,2})?$/.test(refundAmount)} onClick={()=>void act({
            action:"addRefund",connectionId:connection.id,refund:{externalId:`mock-refund-user-${crypto.randomUUID()}`,
              orderExternalId:refundOrder,amount:refundAmount,status:"succeeded",updatedAt:new Date().toISOString()},
          })}>新增模拟退款</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <AppSelect aria-label="选择模拟退款" value={refundToUpdate} onChange={e=>setRefundToUpdate(e.target.value)} className="rounded-lg border bg-white p-2 text-sm">
            <option value="">选择退款</option>{snapshot?.refunds.map(refund=><option key={refund.id} value={refund.external_id}>{refund.external_id}</option>)}
          </AppSelect>
          <AppSelect aria-label="退款状态" value={refundStatus} onChange={e=>setRefundStatus(e.target.value)} className="rounded-lg border bg-white p-2 text-sm">
            <option value="pending">处理中</option><option value="succeeded">成功</option><option value="rejected">拒绝</option>
          </AppSelect>
          <Button variant="outline" disabled={busy||!canEdit||!refundToUpdate} onClick={()=>void act({action:"setRefundStatus",connectionId:connection.id,externalId:refundToUpdate,status:refundStatus})}>更新模拟退款状态</Button>
        </div>
      </SectionCard>
      <SectionCard title="平台 SKU 映射" sub="只建立关联，不改动你维护的商品成本">
        {!snapshot?.skus.length?<p className="text-sm text-[#8fa1b3]">请先同步商品。</p>:
          <div className="space-y-3">{snapshot.skus.map(sku=>{
            const mapping=snapshot.mappings.find(m=>m.external_sku_id===sku.id);
            return <div key={sku.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <div><strong>{sku.name}</strong> · {sku.sku_code||sku.external_id}<span className="ml-2 text-[#8fa1b3]">模拟平台 SKU</span></div>
              <div className="flex items-center gap-2">{mapping?<><span>{internalNames.get(mapping.sku_id)||"已归档内部 SKU"}</span>
                <Button size="sm" variant="outline" disabled={busy||!canEdit} onClick={()=>void act({action:"unbindSku",connectionId:connection.id,externalSkuId:sku.id})}>解除</Button></>:
                <AppSelect aria-label={`绑定 ${sku.external_id}`} disabled={!canEdit||busy} defaultValue="" className="rounded-lg border bg-white p-2" onChange={e=>{if(e.target.value)void act({action:"bindSku",connectionId:connection.id,externalSkuId:sku.id,skuId:e.target.value});}}>
                  <option value="">选择内部 SKU 绑定</option>{[...internalNames].map(([id,name])=><option key={id} value={id}>{name}</option>)}
                </AppSelect>}</div>
            </div>;
          })}</div>}
        <p className="mt-4 text-xs text-[#8fa1b3]">未匹配：{(snapshot?.skus.length||0)-(snapshot?.mappings.length||0)} 个；历史绑定记录：{snapshot?.history.length||0} 条。重复绑定同一内部 SKU 会被数据库拒绝。</p>
      </SectionCard>
      <SectionCard title="SKU 映射历史" sub="最近 60 条绑定和解除记录">
        {!snapshot?.history.length?<p className="text-sm text-[#8fa1b3]">暂无映射变更</p>:<div className="max-h-64 space-y-2 overflow-y-auto text-xs text-[#70879b]">
          {snapshot.history.map(entry=><p key={entry.id} className="border-b border-[#edf2f7] py-2">
            {new Date(entry.created_at).toLocaleString("zh-CN")} · {entry.action==="bound"?"绑定":"解除"} · 平台 SKU {snapshot.skus.find(sku=>sku.id===entry.external_sku_id)?.external_id||entry.external_sku_id} · 店内 SKU {entry.sku_id?internalNames.get(entry.sku_id)||entry.sku_id:"—"}
          </p>)}
        </div>}
      </SectionCard>
      {canAdmin&&<SectionCard title="重置模拟同步数据" sub="仅清除本模拟连接的订单、退款、商品、游标与模拟事件；不影响手工经营记录">
        <Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm("确认重置这个模拟连接的同步数据？"))void act({action:"reset",connectionId:connection.id});}}>
          <RotateCcw size={15}/>重置模拟数据
        </Button>
      </SectionCard>}
    </div>}
    <SectionCard title="官方接入准备" sub="等待拼多多开放平台资质及应用授权。当前无法填写或保存真实凭据。">
      <div className="grid gap-2 text-sm text-[#70879b] sm:grid-cols-2">
        {["Client ID：待申请","Client Secret：待申请，仅服务端加密保存","OAuth Redirect URL：待官方文档确认","Access Token：待授权，仅服务端保存","Refresh Token：待授权，仅服务端保存","授权到期时间：待授权","API 权限状态：待核实"].map(item=><p key={item} className="rounded-xl bg-[#f7fbff] p-3">{item}</p>)}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-[#8fa1b3]"><AlertTriangle size={14}/>获得官方资料后先核对接口、签名和授权流程，再启用正式适配器。</p>
    </SectionCard>
  </>;
}
