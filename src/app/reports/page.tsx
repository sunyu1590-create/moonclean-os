"use client";
import { useState } from "react";
import { Download, Printer, CalendarDays } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { downloadText, MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { financialSummary, formatMoney } from "@/lib/finance";
import { periodRows, storeToday } from "@/lib/analytics";
export default function ReportsPage(){
  const {data}=useApp();const [days,setDays]=useState<7|30>(7);
  if(!data)return <p>正在准备经营报告…</p>;
  const today=storeToday(data.settings.store.timezone);
  const daily=periodRows(data.daily,days,today);const ads=periodRows(data.advertising,days,today);
  const summary=financialSummary(daily,ads);
  const dateRows=daily.map(row=>({row,ad:ads.find(ad=>ad.date===row.date)}));
  const costIncomplete=daily.some(row=>row.costComplete===false);
  const reportTitle=`${data.settings.store.name} · 近 ${days} 天经营报告`;
  function exportCsv(){
    const cell=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`;
    const lines=["日期,销售额,退款,净销售额,订单数,广告消耗,广告归因成交额,广告ROAS,估算经营利润,成本完整",...dateRows.map(({row,ad})=>{
      const net=Number(row.sales)-Number(row.refunds);const profit=financialSummary([row],ad?[ad]:[]).profit;
      const roas=ad&&Number(ad.spend)>0?(Number(ad.attributedSales)/Number(ad.spend)).toFixed(2):"";
      return [row.date,row.sales,row.refunds,net.toFixed(2),row.orders,ad?.spend||"0",ad?.attributedSales||"0",roas,profit,row.costComplete===false?"不完整":"完整"].map(cell).join(",");
    })];
    downloadText(`moonclean-report-${today}-${days}days.csv`,`\uFEFF${lines.join("\n")}`,"text/csv;charset=utf-8");
  }
  return <>
    <PageHead eyebrow="BUSINESS REPORT / 经营报告" title="把日常数据整理成经营复盘" description={`${data.settings.store.name} · 截止 ${today} · 销售额、推广和估算利润统一汇总。`} action={<div className="flex gap-2"><Button variant="outline" onClick={exportCsv}><Download size={16}/>导出 CSV</Button><Button onClick={()=>window.print()}><Printer size={16}/>打印 / 保存 PDF</Button></div>}/>
    <div className="mb-5 flex items-center gap-3"><CalendarDays size={17} className="text-[#287fe2]"/><span className="text-sm text-[#617488]">报告周期</span>{([7,30] as const).map(value=><Button key={value} size="sm" variant={days===value?"default":"outline"} onClick={()=>setDays(value)}>近 {value} 天</Button>)}</div>
    {costIncomplete&&<p className="mb-5 rounded-2xl border border-[#f3dfc8] bg-[#fff9f1] p-4 text-sm text-[#a77743]">所选周期有日期缺少可靠成本，利润是未完整估算。请先补齐成本再用于结算判断。</p>}
    <section id="print-report"><div className="mb-4 hidden print:block"><h1 className="text-2xl font-bold">{reportTitle}</h1><p className="mt-1 text-sm">报告日期：{today}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="全店销售额" value={formatMoney(summary.grossSales)} sub={`退款调整 ${formatMoney(summary.refunds)}`}/><MetricCard label="净销售额" value={formatMoney(summary.netSales)}/><MetricCard label="广告 ROAS" value={summary.roas===null?"无法计算":`${summary.roas.toFixed(2)}x`} sub="广告归因成交额 ÷ 广告消耗"/><MetricCard label="估算经营利润" value={formatMoney(summary.profit)} tone={Number(summary.profit)<0?"red":"green"} sub={costIncomplete?"成本不完整":"基于已录入费用"}/></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><SectionCard title="经营结论" sub={`过去 ${days} 天的数据摘要`}>
        <div className="space-y-3 text-sm leading-6 text-[#53677d]"><p>共录入 {daily.length} 天经营数据，净销售额 {formatMoney(summary.netSales)}，估算经营利润 {formatMoney(summary.profit)}。</p><p>广告消耗 {formatMoney(summary.adSpend)}，广告归因成交额 {formatMoney(ads.reduce((sum,row)=>sum+Number(row.attributedSales),0))}。全店销售额与广告归因成交额分别计算。</p><p>{summary.margin===null?"利润率无法计算。":`估算经营利润率为 ${summary.margin.toFixed(2)}%。`}{costIncomplete?" 当前周期有成本数据不完整的日期。":""}</p></div>
      </SectionCard><SectionCard title="每日明细" sub="可导出 CSV 进一步筛选">
        {!dateRows.length?<p className="text-sm text-[#8194a8]">当前周期暂无经营数据。</p>:<div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="sticky top-0 bg-white text-[#8696a6]"><tr><th className="py-2">日期</th><th>销售额</th><th>广告消耗</th><th>归因成交</th><th>经营利润</th></tr></thead><tbody>{dateRows.map(({row,ad})=><tr key={row.id} className="border-t border-[#edf1f5]"><td className="py-2.5">{row.date}</td><td>{formatMoney(row.sales)}</td><td>{formatMoney(ad?.spend||"0")}</td><td>{formatMoney(ad?.attributedSales||"0")}</td><td className={row.costComplete===false?"text-[#ad855c]":""}>{row.costComplete===false?"不完整 · ":""}{formatMoney(financialSummary([row],ad?[ad]:[]).profit)}</td></tr>)}</tbody></table></div>}
      </SectionCard></div>
    </section>
    <style jsx global>{`@media print { aside, header, nav, button { display:none!important } main { max-width:none!important;padding:0!important } body { background:white!important } .glass-card { box-shadow:none!important;border-color:#ddd!important;break-inside:avoid } #print-report { color:#111 } }`}</style>
  </>;
}
