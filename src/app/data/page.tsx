"use client";
import { useRef, useState } from "react";
import {
  FileUp,
  Plus,
  Pencil,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { SkuDailyPanel } from "@/components/sku-daily-panel";
import {
  PageHead,
  SectionCard,
  ExportButton,
  downloadText,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dailySchema } from "@/lib/repository";
import { exportDailyCsv, parseDailyCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/finance";
import { storeToday } from "@/lib/analytics";
import { ReportImageImport, type ImageReportDraft } from "@/components/report-image-import";
import { QuickMetricEntry, type QuickDailyRow } from "@/components/quick-metric-entry";
import type { DailyMetric } from "@/lib/model";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { dailySourceLabel, isDailyCostComplete, summarizeDataQuality } from "@/lib/operating-review";
const empty = (date: string): DailyMetric => ({
  id: crypto.randomUUID(),
  date,
  sales: "0",
  refunds: "0",
  orders: 0,
  productCost: "0",
  packagingCost: "0",
  logisticsCost: "0",
  platformFees: "0",
  otherExpenses: "0",
  productSales: {},
});
const fields = [
  ["sales", "销售额"],
  ["refunds", "退款金额"],
  ["productCost", "商品成本"],
  ["packagingCost", "包装费用"],
  ["logisticsCost", "物流费用"],
  ["platformFees", "平台费用"],
  ["otherExpenses", "其他经营费用"],
] as const;
export default function DataPage() {
  const { data, update, role, saving, mode } = useApp();
  const canEdit = role !== "viewer";
  const [query, setQuery] = useState("");
  const [dataFilter,setDataFilter]=useState<"all"|"incomplete_cost"|"no_product_split"|"last7"|"last30"|"last30_incomplete_cost"|"last30_no_product_split">("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DailyMetric | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ReturnType<
    typeof parseDailyCsv
  > | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!data) return <p>正在加载数据…</p>;
  function edit(row?: DailyMetric) {
    setDraft(
      row
        ? structuredClone(row)
        : empty(storeToday(data!.settings.store.timezone)),
    );
    setEditing(row?.id || null);
    setError("");
    setOpen(true);
  }
  async function save() {
    if (!draft) return;
    const parsed = dailySchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("；"),
      );
      return;
    }
    if (
      data!.daily.some((row) => row.date === draft.date && row.id !== editing && row.source !== "mock_pinduoduo" && row.source !== "official_pinduoduo")
    ) {
      setError("该日期已有经营数据，请编辑已有记录");
      return;
    }
    try {
      await update((current) => ({
        ...current,
        daily: [
          ...current.daily.filter((row) => row.id !== editing),
          { ...parsed.data, source: parsed.data.source || "manual", isDemo: false },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  async function importFile(file: File) {
    const content = await file.text();
    setPreview(parseDailyCsv(content, data!.daily.filter(row => row.source !== "mock_pinduoduo" && row.source !== "official_pinduoduo")));
    setOverwrite(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  async function confirmImport() {
    if (!preview || preview.errors.length) return;
    const dates = new Set(preview.rows.map((r) => r.date));
    if (preview.duplicates.length && !overwrite) return;
    try {
      await update((current) => ({
        ...current,
        daily: [
          ...current.daily.filter((r) => !dates.has(r.date)),
          ...preview.rows.map((r) => ({
            ...r,
            id: crypto.randomUUID(),
            source: "csv_import" as const,
            isDemo: false,
          })),
        ].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      setPreview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败");
    }
  }
  async function importImage(row:ImageReportDraft):Promise<boolean|void>{
    if(row.kind!=="daily")return false;
    const existing=data!.daily.find(item=>item.date===row.date&&item.source!=="mock_pinduoduo"&&item.source!=="official_pinduoduo");
    if(data!.daily.some(item=>item.date===row.date&&(item.source==="mock_pinduoduo"||item.source==="official_pinduoduo")))throw new Error("该日期包含平台同步数据，请在平台连接中心查看；请勿用截图覆盖同步记录。");
    if(existing&&!window.confirm(`${row.date} 已有手工数据，确认用截图识别结果替换日报指标吗？成本字段会保留。`))return false;
    const optionalInteger=(value:string,label:string)=>{
      if(value==="")return undefined;
      const parsed=Number(value);
      if(!Number.isSafeInteger(parsed))throw new Error(`${label}必须填写整数，请检查识别结果。`);
      return parsed;
    };
    const optionalMoney=(value:string)=>value===""?undefined:value;
    const orders=optionalInteger(row.orders,"成交订单数");
    if(orders===undefined)throw new Error("成交订单数不能为空，请检查识别结果。");
    const result=dailySchema.safeParse({
      id:existing?.id||crypto.randomUUID(),date:row.date,sales:row.sales,refunds:row.refunds,orders,
      productCost:existing?.productCost||"",packagingCost:existing?.packagingCost||"",logisticsCost:existing?.logisticsCost||"",platformFees:existing?.platformFees||"",
      otherExpenses:existing?.otherExpenses||"0",productSales:existing?.productSales||{},source:"image_import",isDemo:false,
      reportDetails:{buyers:optionalInteger(row.buyers,"成交买家数")??existing?.reportDetails?.buyers,averageOrderValue:optionalMoney(row.averageOrderValue)??existing?.reportDetails?.averageOrderValue,visitors:optionalInteger(row.visitors,"商品访客数")??existing?.reportDetails?.visitors,conversionRate:optionalMoney(row.conversionRate)??existing?.reportDetails?.conversionRate,refundOrders:optionalInteger(row.refundOrders,"退款单数")??existing?.reportDetails?.refundOrders,visitorValue:optionalMoney(row.visitorValue)??existing?.reportDetails?.visitorValue},
      costComplete:existing?.costComplete??false,
    });
    if(!result.success){
      const issue=result.error.issues[0];
      const labels:Record<string,string>={orders:"成交订单数",buyers:"成交买家数",visitors:"商品访客数",refundOrders:"退款单数",sales:"成交金额",refunds:"退款金额"};
      throw new Error(`${labels[String(issue.path.at(-1))]||"识别数据"}：${issue.message}`);
    }
    const parsed=result.data;
    await update(current=>({...current,daily:[...current.daily.filter(item=>item.date!==row.date||item.source==="mock_pinduoduo"||item.source==="official_pinduoduo"),parsed].sort((a,b)=>a.date.localeCompare(b.date))}));
  }
  async function importPasted(rows:QuickDailyRow[],overwrite:boolean){
    const byDate=new Map(rows.map(row=>[row.date,row]));
    const protectedDate=rows.find(row=>data!.daily.some(item=>item.date===row.date&&(item.source==="mock_pinduoduo"||item.source==="official_pinduoduo")));
    if(protectedDate)throw new Error(`${protectedDate.date} 已有平台同步数据，不能用批量粘贴覆盖。`);
    const conflicts=rows.filter(row=>data!.daily.some(item=>item.date===row.date));
    if(conflicts.length&&!overwrite&&!window.confirm(`有 ${conflicts.length} 天已有记录，确认覆盖这些手工数据吗？`))return false;
    const parsedRows=rows.map(row=>{
      const old=data!.daily.find(item=>item.date===row.date);
      return dailySchema.parse({id:old?.id||crypto.randomUUID(),...row,
        productCost:row.productCost||old?.productCost||"",packagingCost:row.packagingCost||old?.packagingCost||"",
        logisticsCost:row.logisticsCost||old?.logisticsCost||"",platformFees:row.platformFees||old?.platformFees||"",
        otherExpenses:row.otherExpenses||old?.otherExpenses||"0",productSales:old?.productSales||{},
        source:"csv_import",isDemo:false,costComplete:old?.costComplete??false,
      });
    });
    await update(current=>({...current,daily:[...current.daily.filter(item=>!byDate.has(item.date)),...parsedRows].sort((a,b)=>a.date.localeCompare(b.date))}));
    return true;
  }
  const incompleteCostCount=data.daily.filter(row=>!isDailyCostComplete(row)).length;
  const noProductSplitCount=data.daily.filter(row=>!Object.values(row.productSales||{}).some(value=>Number(value)>0)).length;
  const today=storeToday(data.settings.store.timezone);
  const quality=summarizeDataQuality(data.daily,today);
  const daysAgo=(count:number)=>{const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-count+1);return date.toISOString().slice(0,10);};
  const filtered = [...data.daily]
    .filter((r) => !query || r.date.includes(query.trim()))
    .filter(r=>(dataFilter!=="incomplete_cost"&&dataFilter!=="last30_incomplete_cost")||!isDailyCostComplete(r))
    .filter(r=>(dataFilter!=="no_product_split"&&dataFilter!=="last30_no_product_split")||!Object.values(r.productSales||{}).some(value=>Number(value)>0))
    .filter(r=>dataFilter!=="last7"||(r.date>=daysAgo(7)&&r.date<=today))
    .filter(r=>dataFilter!=="last30"||(r.date>=daysAgo(30)&&r.date<=today))
    .filter(r=>(dataFilter!=="last30_incomplete_cost"&&dataFilter!=="last30_no_product_split")||(r.date>=daysAgo(30)&&r.date<=today))
    .sort((a,b)=>b.date.localeCompare(a.date));
  return (
    <>
      <PageHead
        eyebrow="DATA HUB / 数据中心"
        title="让经营数据有据可查"
        description={mode === "cloud"
          ? "支持报表截图识别、表格粘贴、CSV 导入和逐日编辑，确认保存后同步到云端店铺。"
          : "支持报表截图识别、表格粘贴、CSV 导入和逐日编辑，数据保存在当前浏览器。"}
        action={
          <div className="flex flex-wrap gap-2">
            <ExportButton
              label="导出 CSV"
              onClick={() =>
                downloadText(
                  "moonclean-daily.csv",
                  exportDailyCsv(data.daily.filter(row => row.source !== "mock_pinduoduo" && row.source !== "official_pinduoduo")),
                  "text/csv;charset=utf-8",
                )
              }
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={!canEdit}
            >
              <FileUp size={16} />
              导入 CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && importFile(e.target.files[0])
              }
            />
            <Button onClick={() => edit()} disabled={!canEdit}>
              <Plus size={16} />
              录入数据
            </Button>
          </div>
        }
      />
      <AiInsightPanel feature="data" context={{ recordCount: data.daily.length, daysMissingCosts: data.daily.filter(row => !isDailyCostComplete(row)).length, daysWithProductSales: data.daily.filter(row => Object.keys(row.productSales || {}).length > 0).length, latest7DaysSales: data.daily.slice(-7).reduce((sum, row) => sum + Number(row.sales || 0), 0), latest7DaysOrders: data.daily.slice(-7).reduce((sum, row) => sum + row.orders, 0) }} />
      <SectionCard title="近 30 天数据质量与来源" sub={`${quality.startDate} 至 ${quality.endDate} · 按已有日报检查，不补造缺失数据`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">日报覆盖</p><p className="number mt-1 text-lg font-semibold text-foreground">{quality.coveredDays}<span className="ml-1 text-xs font-medium text-muted-foreground">/ 30 天</span></p></div>
          <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">成本信息完整</p><p className="number mt-1 text-lg font-semibold text-foreground">{quality.rows.length-quality.incompleteCostRecords}<span className="ml-1 text-xs font-medium text-muted-foreground">/ {quality.rows.length} 条</span></p></div>
          <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">已分配商品销售</p><p className="number mt-1 text-lg font-semibold text-foreground">{quality.productAllocatedRecords}<span className="ml-1 text-xs font-medium text-muted-foreground">/ {quality.rows.length} 条</span></p><p className="mt-1 text-[10px] text-muted-foreground">商品分摊为可选项</p></div>
          <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">记录来源</p><p className="mt-1 text-xs font-semibold text-foreground">日报 {quality.rows.length} 条</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">手工 {quality.sourceCounts.manual} · 导入 {quality.sourceCounts.imported} · 模拟 {quality.sourceCounts.demo} · 正式同步 {quality.sourceCounts.official}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          {quality.incompleteCostRecords>0&&<Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={()=>setDataFilter("last30_incomplete_cost")}>查看成本缺失记录 {quality.incompleteCostRecords}</Button>}
          {quality.rows.length-quality.productAllocatedRecords>0&&<Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={()=>setDataFilter("last30_no_product_split")}>查看未分摊记录 {quality.rows.length-quality.productAllocatedRecords}</Button>}
          {!quality.rows.length&&<span>近 30 天暂无日报。录入或导入后，这里会展示覆盖、成本与来源情况。</span>}
          {quality.hasDemo&&<span className="rounded-full bg-[var(--mc-tint-orange)] px-2 py-1 text-[var(--mc-color-warning)]">包含模拟平台数据，不能作为真实业绩</span>}
          {!quality.hasDemo&&quality.sourceCounts.official===0&&quality.rows.length>0&&<span>当前周期没有平台正式同步记录；请按来源标识解读手工与导入数据。</span>}
          {quality.sourceCounts.official>0&&<span>包含 {quality.sourceCounts.official} 条拼多多正式同步记录。</span>}
        </div>
      </SectionCard>
      <div className="mb-5">
        <ReportImageImport defaultDate={storeToday(data.settings.store.timezone)} disabled={!canEdit} onImport={importImage}/>
      </div>
      <div className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4 text-sm text-muted-foreground">
        CSV 字段：date, sales, refunds, orders, productCost, packagingCost,
        logisticsCost, platformFees, otherExpenses,
        productSales。建议先导出样例，再按相同格式填写；productSales 是商品 ID
        与销售额的 JSON 对象。
      </div>
      <div className="mb-5"><QuickMetricEntry rows={data.daily} disabled={!canEdit} onImport={importPasted}/></div>
      <SectionCard
        title="历史经营数据"
        sub={`共 ${data.daily.length} 条日记录 · 当前显示 ${filtered.length} 条`}
        action={
          <div className="flex flex-wrap gap-2"><AppSelect aria-label="按数据质量和日期筛选" value={dataFilter} onChange={event=>setDataFilter(event.target.value as typeof dataFilter)} className="h-9 rounded-xl border border-border bg-card px-3 text-xs"><option value="all">全部日期</option><option value="incomplete_cost">成本待补齐（{incompleteCostCount}）</option><option value="no_product_split">商品未分配（{noProductSplitCount}）</option><option value="last7">近 7 天</option><option value="last30">近 30 天</option><option value="last30_incomplete_cost">近 30 天 · 成本缺失（{quality.incompleteCostRecords}）</option><option value="last30_no_product_split">近 30 天 · 未分摊（{quality.rows.length-quality.productAllocatedRecords}）</option></AppSelect><div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-muted-foreground"
              size={15}
            />
            <Input
              className="w-40 pl-9"
              placeholder="搜索日期"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div></div>
        }
      >
        {(incompleteCostCount>0||noProductSplitCount>0)&&<div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs text-muted-foreground"><strong className="text-foreground">快速定位</strong>{incompleteCostCount>0&&<Button type="button" size="sm" variant={dataFilter==="incomplete_cost"?"default":"outline"} className="h-7 px-2 text-[11px]" onClick={()=>setDataFilter(dataFilter==="incomplete_cost"?"all":"incomplete_cost")}>成本待补齐 {incompleteCostCount} 天</Button>}{noProductSplitCount>0&&<Button type="button" size="sm" variant={dataFilter==="no_product_split"?"default":"outline"} className="h-7 px-2 text-[11px]" onClick={()=>setDataFilter(dataFilter==="no_product_split"?"all":"no_product_split")}>可选商品分摊 {noProductSplitCount} 天</Button>}<span>商品分摊为可选项；筛选后可直接编辑日报。</span></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-3">日期</th>
                <th>销售额</th>
                <th>退款</th>
                <th>订单量</th>
                <th>商品成本</th>
                <th>物流费用</th>
                <th>日报补充指标</th>
                <th>其他费用</th>
                <th>数据检查</th>
                <th>来源</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 font-semibold">{row.date}</td>
                  <td>{formatMoney(row.sales)}</td>
                  <td>{formatMoney(row.refunds)}</td>
                  <td>{row.orders}</td>
                  <td>{formatMoney(row.productCost)}</td>
                  <td>{formatMoney(row.logisticsCost)}</td>
                  <td className="text-xs text-muted-foreground">
                    {row.reportDetails ? <details className="cursor-pointer"><summary>查看指标</summary><div className="mt-2 min-w-40 space-y-1 rounded-lg bg-[var(--mc-tint-blue)] p-2"><p>买家 {row.reportDetails.buyers ?? "—"} · 访客 {row.reportDetails.visitors ?? "—"}</p><p>客单价 {row.reportDetails.averageOrderValue ? formatMoney(row.reportDetails.averageOrderValue) : "—"}</p><p>转化率 {row.reportDetails.conversionRate ? `${row.reportDetails.conversionRate}%` : "—"}</p><p>退款单 {row.reportDetails.refundOrders ?? "—"} · 访客价值 {row.reportDetails.visitorValue ? formatMoney(row.reportDetails.visitorValue) : "—"}</p></div></details> : "—"}
                  </td>
                  <td>{formatMoney(row.otherExpenses)}</td>
                  <td className="text-xs text-muted-foreground">
                    <span className="flex flex-wrap gap-1.5">{!isDailyCostComplete(row)&&<span className="rounded-full bg-[var(--mc-tint-orange)] px-2 py-1 text-[var(--mc-color-warning)]">成本待补</span>}{!Object.values(row.productSales||{}).some(value=>Number(value)>0)&&<span className="rounded-full bg-[var(--mc-tint-blue)] px-2 py-1 text-primary">未分摊（可选）</span>}{isDailyCostComplete(row)&&Object.values(row.productSales||{}).some(value=>Number(value)>0)&&<span className="text-[var(--mc-color-success)]">成本完整</span>}</span>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {row.source === "mock_pinduoduo" ? "拼多多模拟同步" : dailySourceLabel(row)}
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => edit(row)}
                      disabled={!canEdit || row.source === "mock_pinduoduo" || row.source === "official_pinduoduo"}
                    >
                      <Pencil size={14} />
                      编辑
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              没有匹配的记录
            </p>
          )}
        </div>
      </SectionCard>
      <SkuDailyPanel />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑" : "录入"}每日经营数据</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-5 pt-2">
              {draft.costSource === "sku" && <p className="rounded-xl bg-[var(--mc-tint-orange)] p-3 text-xs text-[var(--mc-color-warning)]">此日期使用 SKU 历史成本自动核算。下方商品、包装、物流和平台汇总成本仅供查看，编辑销售数据不会覆盖成本版本。</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>日期</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    disabled={draft.costSource === "sku"}
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>订单量</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="mt-1.5"
                    value={draft.orders}
                    onChange={(e) =>
                      setDraft({ ...draft, orders: Number(e.target.value) })
                    }
                  />
                </div>
                {fields.map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}（元）</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1.5"
                      disabled={draft.costSource === "sku" && ["productCost","packagingCost","logisticsCost","platformFees"].includes(key)}
                    value={draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <h3 className="mb-1 text-sm font-semibold">商品销售额分配</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  用于商品排行，可留空；不会重复计入总销售额。
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.products.map((product) => (
                    <div key={product.id}>
                      <Label>{product.name}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1.5"
                        value={draft.productSales[product.id] || "0"}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            productSales: {
                              ...draft.productSales,
                              [product.id]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-[var(--mc-color-danger)]">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "保存中…" : "保存数据"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="sm:max-w-[670px]">
          <DialogHeader>
            <DialogTitle>CSV 导入预览</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              {error && <p role="alert" className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]">{error}</p>}
              <div className="rounded-xl bg-[var(--mc-tint-blue)] p-4 text-sm">
                识别 {preview.rows.length} 条有效记录，
                {preview.duplicates.length} 条日期与现有数据重复，
                {preview.errors.length} 个错误。
              </div>
              {preview.errors.length > 0 && (
                <div className="max-h-36 overflow-auto rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs text-[var(--mc-color-danger)]">
                  {preview.errors.map((e, i) => (
                    <p key={i} className="mb-1 flex gap-2">
                      <AlertCircle size={14} />
                      {e}
                    </p>
                  ))}
                </div>
              )}
              {preview.duplicates.length > 0 && (
                <label className="flex items-start gap-2 rounded-xl border border-border bg-[var(--mc-tint-orange)] p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="mt-1"
                  />
                  用 CSV 记录覆盖已有日期：
                  {preview.duplicates.slice(0, 5).join("、")}
                  {preview.duplicates.length > 5 ? "等" : ""}
                </label>
              )}
              <div className="max-h-48 overflow-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--mc-tint-blue)]">
                    <tr>
                      <th className="p-2">日期</th>
                      <th>销售额</th>
                      <th>订单量</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.date} className="border-t">
                        <td className="p-2">{row.date}</td>
                        <td>{formatMoney(row.sales)}</td>
                        <td>{row.orders}</td>
                        <td>
                          {preview.duplicates.includes(row.date)
                            ? "日期重复"
                            : "可导入"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                className="w-full"
                disabled={
                  !!preview.errors.length ||
                  !preview.rows.length ||
                  (preview.duplicates.length > 0 && !overwrite)
                }
                onClick={() => void confirmImport()}
              >
                <CheckCircle2 size={16} />
                确认导入 {preview.rows.length} 条
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
