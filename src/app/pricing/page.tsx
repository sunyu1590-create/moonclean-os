"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { Calculator, CircleHelp, Target } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance";
export default function PricingPage(){
  const {data}=useApp();const [skuId,setSkuId]=useState("");const [price,setPrice]=useState("");const [feeRate,setFeeRate]=useState("0");const [targetMargin,setTargetMargin]=useState("20");
  const skus=useMemo(()=>data?.products.flatMap(product=>product.skus.map(sku=>({product,sku})))||[],[data]);
  const selected=skus.find(item=>item.sku.id===skuId)||skus[0];
  if(!data)return <p>正在读取定价工具…</p>;
  const current=selected?.sku;
  const inputPrice=price===""?new Decimal(current?.price||0):new Decimal(price||0);
  const fixedCost=current?new Decimal(current.cost.production||0).plus(current.cost.packaging||0).plus(current.cost.logistics||0).plus(current.cost.platform||0):new Decimal(0);
  const variableRate=new Decimal(feeRate||0).div(100);
  const contribution=inputPrice.mul(new Decimal(1).minus(variableRate)).minus(fixedCost);
  const margin=inputPrice.gt(0)?contribution.div(inputPrice).mul(100):new Decimal(0);
  const breakEven=contribution.gt(0)?inputPrice.div(contribution):null;
  const targetRate=new Decimal(targetMargin||0).div(100).plus(variableRate);
  const targetPrice=targetRate.lt(1)?fixedCost.div(new Decimal(1).minus(targetRate)):null;
  function choose(id:string){setSkuId(id);setPrice("");}
  const costComplete=!!current&&current.costComplete!==false;
  return <>
    <PageHead eyebrow="PRICING LAB / 定价模拟" title="调价之前，先算一遍利润" description="选择 SKU 后调整售价和比例费用，实时查看单件贡献利润与保本 ROAS；模拟结果不会修改商品售价。"/>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]"><SectionCard title="模拟条件" sub="SKU 固定成本取商品管理中的当前成本版本">
      <div className="space-y-5"><div><label htmlFor="pricing-sku" className="text-sm font-medium">商品规格</label><AppSelect id="pricing-sku" className="mt-2 h-10 w-full rounded-xl border border-[#e3eaf1] bg-white px-3 text-sm" value={current?.id||""} onChange={e=>choose(e.target.value)}><option value="">选择 SKU</option>{skus.map(({product,sku})=><option key={sku.id} value={sku.id}>{product.name} · {sku.name}</option>)}</AppSelect></div>
        <div><label htmlFor="pricing-price" className="text-sm font-medium">模拟售价（元）</label><Input id="pricing-price" type="number" min="0" step="0.01" value={price===""?(current?.price||""):price} onChange={e=>setPrice(e.target.value)} className="mt-2"/><p className="mt-1 text-xs text-[#8999a9]">当前 SKU 售价：{formatMoney(current?.price||0)}</p></div>
        <div><label htmlFor="pricing-fee" className="text-sm font-medium">额外比例费用（%）</label><Input id="pricing-fee" type="number" min="0" max="99" step="0.1" value={feeRate} onChange={e=>setFeeRate(e.target.value)} className="mt-2"/><p className="mt-1 text-xs text-[#8999a9]">可填写活动扣点等按成交额比例收取的费用；广告费用按 ROAS 单独衡量。</p></div>
        <div><label htmlFor="pricing-margin" className="text-sm font-medium">目标贡献利润率（%）</label><Input id="pricing-margin" type="number" min="0" max="90" step="1" value={targetMargin} onChange={e=>setTargetMargin(e.target.value)} className="mt-2"/></div>
      </div>
    </SectionCard><SectionCard title="模拟结果" sub="不包含税费、仓储和未录入成本">
      {!current?<p className="text-sm text-[#8999a9]">请先在商品管理添加商品规格。</p>:!costComplete?<p className="rounded-xl bg-[#fff8f1] p-4 text-sm text-[#a77743]">该 SKU 缺少完整成本版本。请补充成本后再查看利润与保本 ROAS。</p>:<>
        <div className="grid gap-3 sm:grid-cols-2"><MetricCard label="单件贡献利润" value={formatMoney(contribution.toFixed(2))} tone={contribution.gte(0)?"green":"red"} icon={<Calculator size={19}/>} sub="模拟售价 − 固定单位成本 − 比例费用"/><MetricCard label="贡献利润率" value={`${margin.toFixed(1)}%`} tone={margin.gte(0)?"green":"red"}/><MetricCard label="盈亏平衡 ROAS" value={breakEven?`${breakEven.toFixed(2)}x`:"无法达到"} icon={<Target size={19}/>} sub="售价 ÷ 广告前贡献利润"/><MetricCard label="达到目标利润率的售价" value={targetPrice?formatMoney(targetPrice.toFixed(2)):"目标不可达"} sub={`目标贡献利润率 ${targetMargin}%`}/></div>
        <div className="mt-4 rounded-xl bg-[#f7f9fb] p-4 text-sm text-[#617488]">成本明细：商品 {formatMoney(current.cost.production)} · 包装 {formatMoney(current.cost.packaging)} · 物流 {formatMoney(current.cost.logistics)} · 平台 {formatMoney(current.cost.platform)}</div>
      </>}
    </SectionCard></div>
    <p className="mt-5 text-xs leading-5 text-[#8b9aaa]"><CircleHelp className="mr-1 inline size-4"/>模拟器不会保存修改，也不会把全店成交额当作广告归因成交额。</p>
  </>;
}
