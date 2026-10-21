"use client";
import Link from "next/link";
import { useState } from "react";
import Decimal from "decimal.js";
import { AlertTriangle, ArrowRight, CircleDollarSign, PackageSearch, TrendingUp } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { formatMoney, skuContribution } from "@/lib/finance";
import { storeToday } from "@/lib/analytics";
import { AiInsightPanel } from "@/components/ai-insight-panel";
export default function ProductInsightsPage(){
  const {data}=useApp();
  const [issue,setIssue]=useState("all");const [query,setQuery]=useState("");
  if(!data)return <p>正在读取商品诊断…</p>;
  const today=storeToday(data.settings.store.timezone);
  const cutoff=new Date(`${today}T00:00:00`);cutoff.setDate(cutoff.getDate()-29);
  const from=cutoff.toLocaleDateString("en-CA");
  const rows=data.daily.filter(row=>row.date>=from&&row.date<=today);
  const units=data.skuDaily||[];
  const stockBySku=new Map((data.inventory||[]).map(row=>[row.sku_id,row]));
  const perProduct=data.products.map(product=>{
    const sales=rows.reduce((sum,row)=>sum+Number(row.productSales[product.id]||0),0);
    const productSku=product.skus;
    const skuUnits=productSku.flatMap(sku=>units.filter(line=>line.skuId===sku.id&&line.date>=from&&line.date<=today));
    const hasUnits=skuUnits.length>0;
    const refund=skuUnits.reduce((sum,line)=>sum+Number(line.refundAmount),0);
    const unitSales=skuUnits.reduce((sum,line)=>sum+Number(line.grossSales),0);
    const costsComplete=productSku.every(sku=>sku.costComplete!==false);
    let skuCostsComplete=true;
    const estimatedContribution=hasUnits&&costsComplete?skuUnits.reduce((sum,line)=>{
      const sku=productSku.find(item=>item.id===line.skuId);
      if(!sku)return sum;
      const historical=sku.costHistory?.filter(item=>item.effectiveFrom<=line.date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]?.cost;
      const cost=historical|| (sku.costComplete!==false?sku.cost:null);
      if(!cost){skuCostsComplete=false;return sum;}
      const unitCost=new Decimal(cost.production).plus(cost.packaging).plus(cost.logistics).plus(cost.platform);
      const lineContribution=new Decimal(line.grossSales).minus(line.refundAmount).minus(unitCost.mul(line.quantitySold));
      return sum.plus(lineContribution);
    },new Decimal(0)).toFixed(2):null;
    const contributionAvailable=skuCostsComplete&&estimatedContribution!==null;
    const negativeSkus=productSku.filter(sku=>sku.costComplete!==false&&Number(skuContribution(sku))<=0);
    const trackedStock=productSku.flatMap(sku=>{const balance=stockBySku.get(sku.id);return balance?[balance]:[];});
    const stockUnits=trackedStock.reduce((sum,row)=>sum+row.quantity,0);
    const lowStock=trackedStock.filter(row=>row.quantity<=row.low_stock_threshold).length;
    const stale=!rows.some(row=>row.productSales[product.id]&&Number(row.productSales[product.id])>0);
    const refundRate=unitSales>0?refund/unitSales*100:null;
    return {product,sales,estimatedContribution:contributionAvailable?estimatedContribution:null,costsComplete,negativeSkus,stale,refundRate,hasUnits,stockUnits,lowStock,stockTracked:trackedStock.length};
  }).sort((a,b)=>b.sales-a.sales);
  const totalSales=perProduct.reduce((sum,row)=>sum+row.sales,0);
  const alerts=perProduct.flatMap(row=>[
    ...row.negativeSkus.map(sku=>`${row.product.name} · ${sku.name} 规格贡献利润不为正`),
    ...(!row.costsComplete?[`${row.product.name} 有 SKU 缺少完整成本`]:[]),
    ...(row.stale?[`${row.product.name} 近 30 天没有录入商品销售额`]:[]),
    ...(row.refundRate!==null&&row.refundRate>=10?[`${row.product.name} SKU 退款率约 ${row.refundRate.toFixed(1)}%`]:[]),
  ]);
  const visibleProducts=perProduct.filter(row=>{
    if(query.trim()&&!`${row.product.name} ${row.product.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))return false;
    if(issue==="low_margin")return row.negativeSkus.length>0;
    if(issue==="missing_cost")return !row.costsComplete;
    if(issue==="refund")return row.refundRate!==null&&row.refundRate>=10;
    if(issue==="no_sales")return row.stale;
    if(issue==="low_stock")return row.lowStock>0;
    return true;
  }).sort((a,b)=>{
    const severity=(row:typeof perProduct[number])=>Number(row.negativeSkus.length>0)*8+Number(!row.costsComplete)*4+Number(row.refundRate!==null&&row.refundRate>=10)*3+Number(row.lowStock>0)*2+Number(row.stale);
    return severity(b)-severity(a)||b.sales-a.sales;
  });
  return <>
    <PageHead eyebrow="PRODUCT HEALTH / 商品诊断" title="把需要关注的商品找出来" description="结合近 30 天商品销售、SKU 成本和 SKU 日销量，提示成本缺失、低贡献和退款情况。" action={<Link className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/pricing">打开定价模拟器 <ArrowRight size={15}/></Link>}/>
    <AiInsightPanel feature="product-insights" context={{ periodDays: 30, productCount: perProduct.length, sales: totalSales, attentionCount: alerts.length, lowContributionProducts: perProduct.filter(row=>row.negativeSkus.length>0).length, incompleteCostProducts: perProduct.filter(row=>!row.costsComplete).length, highRefundProducts: perProduct.filter(row=>row.refundRate!==null&&row.refundRate>=10).length }} />
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><MetricCard label="近 30 天商品销售额" value={formatMoney(totalSales)} icon={<TrendingUp size={19}/>} sub="仅统计已分配到商品的销售额"/><MetricCard label="商品数" value={String(perProduct.length)} icon={<PackageSearch size={19}/>} /><MetricCard label="需关注事项" value={String(alerts.length)} tone={alerts.length?"red":"green"} icon={<AlertTriangle size={19}/>} sub="按当前已录入数据识别"/></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]"><SectionCard title="商品表现" sub="先按风险等级排序，也可搜索商品或只看某类问题" action={<div className="flex flex-wrap gap-2"><AppSelect aria-label="按商品问题筛选" value={issue} onChange={event=>setIssue(event.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><option value="all">全部问题</option><option value="low_margin">贡献利润不为正</option><option value="missing_cost">成本缺失</option><option value="refund">退款率偏高</option><option value="low_stock">库存预警</option><option value="no_sales">近 30 天无销售</option></AppSelect></div>}>
      <Input aria-label="搜索商品" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索商品名称或品类" className="mb-3"/>
      {!perProduct.length?<p className="text-sm text-muted-foreground">暂无商品，请先在商品管理维护商品。</p>:visibleProducts.length===0?<p className="text-sm text-muted-foreground">没有符合条件的商品。可清除搜索或更换问题筛选。</p>:<div className="space-y-3">{visibleProducts.map(row=><div key={row.product.id} className="rounded-2xl border border-border p-3 md:p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm text-foreground">{row.product.name}</strong><p className="mt-1 text-xs text-muted-foreground">{row.product.category} · {row.product.skus.length} 个 SKU</p></div><strong className="text-base text-foreground">{formatMoney(row.sales)}</strong></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4"><div className="rounded-xl bg-[var(--mc-tint-blue)] p-2.5 md:p-3">SKU 销量估算贡献<br/><strong className="mt-1 inline-block text-sm">{row.estimatedContribution===null?"数据不完整":formatMoney(row.estimatedContribution)}</strong></div><div className="rounded-xl bg-[var(--mc-tint-blue)] p-2.5 md:p-3">SKU 退款率<br/><strong className="mt-1 inline-block text-sm">{row.refundRate===null?"暂无数据":`${row.refundRate.toFixed(1)}%`}</strong></div><div className="rounded-xl bg-[var(--mc-tint-blue)] p-2.5 md:p-3">成本覆盖<br/><strong className="mt-1 inline-block text-sm">{row.costsComplete?"完整":"有缺失"}</strong></div><div className="rounded-xl bg-[var(--mc-tint-blue)] p-2.5 md:p-3">已登记库存<br/><strong className="mt-1 inline-block text-sm">{row.stockTracked?`${row.stockUnits} 件`:`${row.product.skus.length} 个 SKU 未登记`}{row.lowStock>0&&<span className="ml-1 text-[var(--mc-color-danger)]">· {row.lowStock} 项预警</span>}</strong></div></div></div>)}</div>}
    </SectionCard><SectionCard title="经营诊断" sub="销售额依赖商品分配；退款率依赖 SKU 日销量数据">
      {!alerts.length?<p className="rounded-xl bg-[var(--mc-tint-green)] p-4 text-sm text-[var(--mc-color-success)]">当前数据没有发现明显异常。补录商品销售和 SKU 日销量可获得更完整的诊断。</p>:<div className="space-y-2">{alerts.map((alert,index)=><div key={`${alert}-${index}`} className="flex gap-3 rounded-xl bg-[var(--mc-tint-orange)] p-3 text-sm text-[var(--mc-color-warning)]"><AlertTriangle size={16} className="mt-0.5 shrink-0"/>{alert}</div>)}</div>}
      <div className="mt-4 flex flex-wrap gap-2"><Link href="/products" className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">维护商品成本</Link><Link href="/data" className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">补录 SKU 销量</Link><Link href="/inventory" className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">管理库存</Link></div>
    </SectionCard></div>
    <div className="mt-5 rounded-2xl bg-[var(--mc-tint-blue)] p-4 text-xs leading-5 text-muted-foreground"><CircleDollarSign className="mr-1 inline size-4"/>SKU 销量贡献按商品行成交额减退款及匹配成本估算；有历史成本时按生效日期匹配，没有历史版本时使用当前单位成本。SKU 日销量或成本不完整时不显示该商品估算贡献。</div>
  </>;
}
