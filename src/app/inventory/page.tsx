"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, ClipboardList, RefreshCw, Save } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type InventoryBalance, type InventoryMovement, operationsRequest } from "@/lib/operations";

type Snapshot = {balances:InventoryBalance[];movements:InventoryMovement[]};
export default function InventoryPage(){
  const {data,mode,activeStoreId,role}=useApp();
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState("");const [quantity,setQuantity]=useState("0");
  const [threshold,setThreshold]=useState("10");const [note,setNote]=useState("");
  const skus=useMemo(()=>data?.products.flatMap(product=>product.skus.map(sku=>({id:sku.id,label:`${product.name} · ${sku.name}`})))||[],[data]);
  const names=new Map(skus.map(sku=>[sku.id,sku.label]));
  const load=useCallback(async()=>{
    if(!activeStoreId)return;
    setLoading(true);setError("");
    try{setSnapshot(await operationsRequest<Snapshot>(activeStoreId,"inventory"));}
    catch(cause){setError(cause instanceof Error?cause.message:"库存读取失败");}
    finally{setLoading(false);}
  },[activeStoreId]);
  useEffect(()=>{queueMicrotask(()=>{setSnapshot(null);void load();});},[load]);
  function choose(id:string){
    setSelected(id);const balance=snapshot?.balances.find(row=>row.sku_id===id);
    setQuantity(String(balance?.quantity??0));setThreshold(String(balance?.low_stock_threshold??10));setNote("");
  }
  async function save(event:React.FormEvent){
    event.preventDefault();if(!activeStoreId||!selected)return;
    setBusy(true);setError("");setNotice("");
    try{
      await operationsRequest(activeStoreId,"inventory",{skuId:selected,quantity:Number(quantity),threshold:Number(threshold),note},"POST");
      await load();setNote("");setNotice("库存已保存到云端，调整流水已记录。");
    }catch(cause){setError(cause instanceof Error?cause.message:"库存保存失败");}
    finally{setBusy(false);}
  }
  const balances=snapshot?.balances||[];
  const low=balances.filter(row=>row.quantity<=row.low_stock_threshold);
  const canEdit=mode==="cloud"&&role!=="viewer";
  return <>
    <PageHead eyebrow="INVENTORY / 库存管理" title="每个规格的库存，心中有数" description="手工维护库存数量与预警线，所有调整保留历史。模拟订单不会自动扣减库存。" action={<Button variant="outline" onClick={()=>void load()} disabled={loading||mode!=="cloud"}><RefreshCw size={16}/>刷新</Button>}/>
    {mode!=="cloud"&&<p className="mb-5 rounded-2xl bg-[#e8f5ff] p-4 text-sm text-[#476d91]">库存功能使用云端店铺。配置 Supabase 并登录后即可跨设备使用。</p>}
    {error&&<p role="alert" className="mb-5 rounded-xl bg-[#fff0f1] p-4 text-sm text-[#d35760]">{error}</p>}
    {notice&&<p role="status" className="mb-5 rounded-xl bg-[#e7f8f4] p-4 text-sm text-[#167c68]">{notice}</p>}
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <MetricCard label="在售 SKU" value={String(skus.length)} icon={<Boxes size={19}/>}/>
      <MetricCard label="已设库存" value={String(balances.length)} icon={<ClipboardList size={19}/>}/>
      <MetricCard label="低库存预警" value={String(low.length)} tone={low.length?"red":"green"} icon={<AlertTriangle size={19}/>} sub="已设库存且数量低于或等于预警线"/>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,1fr)]">
      <SectionCard title="SKU 库存" sub="未设置库存的规格显示为“未录入”，不视为零库存">
        {loading?<p className="text-sm text-[#8194a8]">正在读取云端库存…</p>:skus.length===0?<p className="text-sm text-[#8194a8]">暂无在售 SKU，请先到商品管理添加商品规格。</p>:<div className="space-y-2">
          {skus.map(sku=>{const row=balances.find(item=>item.sku_id===sku.id);const isLow=row&&row.quantity<=row.low_stock_threshold;return <button key={sku.id} type="button" onClick={()=>choose(sku.id)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${selected===sku.id?"border-[#8dc2fa] bg-[#f0f7ff]":"border-[#e9eef3] hover:bg-[#f8fafc]"}`}>
            <span className="min-w-0 truncate text-sm font-medium text-[#26374c]">{sku.label}</span>
            <span className={`shrink-0 text-sm font-semibold ${isLow?"text-[#e85d65]":"text-[#4e6b85]"}`}>{row?`${row.quantity} 件${isLow?" · 低库存":""}`:"未录入"}</span>
          </button>;})}
        </div>}
      </SectionCard>
      <SectionCard title="调整库存" sub="填写调整原因，方便事后追溯">
        {!canEdit?<p className="text-sm text-[#8194a8]">当前账号仅能查看库存，或当前为本地演示模式。</p>:<form onSubmit={save} className="space-y-4">
          <div><label htmlFor="inventory-sku" className="text-sm font-medium">商品规格</label><AppSelect id="inventory-sku" className="mt-2 h-10 w-full rounded-xl border border-[#e3eaf1] bg-white px-3 text-sm" value={selected} onChange={e=>choose(e.target.value)} required><option value="">请选择规格</option>{skus.map(sku=><option value={sku.id} key={sku.id}>{sku.label}</option>)}</AppSelect></div>
          <div className="grid grid-cols-2 gap-3"><div><label htmlFor="inventory-quantity" className="text-sm font-medium">当前数量</label><Input id="inventory-quantity" type="number" min="0" max="100000000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-2" required/></div><div><label htmlFor="inventory-threshold" className="text-sm font-medium">预警线</label><Input id="inventory-threshold" type="number" min="0" max="100000000" step="1" value={threshold} onChange={e=>setThreshold(e.target.value)} className="mt-2" required/></div></div>
          <div><label htmlFor="inventory-note" className="text-sm font-medium">调整原因</label><Input id="inventory-note" value={note} maxLength={240} onChange={e=>setNote(e.target.value)} placeholder="如：仓库盘点、采购入库" className="mt-2" required/></div>
          <Button type="submit" disabled={busy||!selected||!note.trim()}><Save size={16}/>{busy?"正在保存…":"保存库存"}</Button>
        </form>}
      </SectionCard>
    </div>
    <div className="mt-5"><SectionCard title="最近调整流水" sub="仅显示最近 30 条，完整历史保存在云端">
      {!snapshot?.movements.length?<p className="text-sm text-[#8194a8]">暂无库存调整。</p>:<div className="space-y-2">{snapshot.movements.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1f4] py-2.5 text-sm"><div><strong>{names.get(row.sku_id)||"已归档 SKU"}</strong><span className="ml-2 text-[#8194a8]">{row.note}</span></div><div className="text-[#53677d]">{row.quantity_before} → {row.quantity_after} <span className={row.delta>=0?"text-[#16a085]":"text-[#e85d65]"}>({row.delta>0?"+":""}{row.delta})</span><span className="ml-3 text-xs text-[#9aa8b6]">{new Date(row.created_at).toLocaleString("zh-CN")}</span></div></div>)}</div>}
    </SectionCard></div>
  </>;
}
