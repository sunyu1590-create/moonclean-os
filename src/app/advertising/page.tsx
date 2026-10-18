"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Pencil, TrendingUp, Target, Wallet, Ratio } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addMoney, adRoas, financialSummary, formatMoney } from "@/lib/finance";
import { numeric, periodRows, storeToday } from "@/lib/analytics";
import type { AdvertisingMetric } from "@/lib/model";
import { ReportImageImport, type ImageReportDraft } from "@/components/report-image-import";
import { AiInsightPanel } from "@/components/ai-insight-panel";
const schema = z.object({
  date: z.iso.date(),
  spend: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入有效金额"),
  attributedSales: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入有效金额"),
  attributedOrders: z.number().int().nonnegative(),
});
type Form = z.infer<typeof schema>;
export default function Advertising() {
  const { data, update, role, saving } = useApp();
  const [days, setDays] = useState<7 | 30>(7);
  const [open, setOpen] = useState(false);
  const canEdit = role !== "viewer";
  const [editing, setEditing] = useState<string | null>(null);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: "",
      spend: "0",
      attributedSales: "0",
      attributedOrders: 0,
    },
  });
  if (!data) return <p>正在加载数据…</p>;
  const rows = periodRows(
      data.daily,
      days,
      storeToday(data.settings.store.timezone),
    ),
    ads = periodRows(
      data.advertising,
      days,
      storeToday(data.settings.store.timezone),
    ),
    summary = financialSummary(rows, ads);
  const attributed = addMoney(ads.map((a) => a.attributedSales));
  const adTrend = ads.map((ad) => ({
    date: ad.date.slice(5).replace("-", "/"),
    spend: Number(ad.spend),
    attributedSales: Number(ad.attributedSales),
  }));
  function edit(ad?: AdvertisingMetric) {
    setEditing(ad?.id || null);
    form.reset({
      date: ad?.date || storeToday(data!.settings.store.timezone),
      spend: ad?.spend || "0",
      attributedSales: ad?.attributedSales || "0",
      attributedOrders: ad?.attributedOrders || 0,
    });
    setOpen(true);
  }
  async function save(values: Form) {
    const existing = data!.advertising.find(
      (a) => a.date === values.date && a.id !== editing,
    );
    if (existing) {
      form.setError("date", { message: "该日期已有推广数据，请编辑已有记录" });
      return;
    }
    try {
      await update((current) => ({
        ...current,
        advertising: [
          ...current.advertising.filter((a) => a.id !== editing),
          { id: editing || crypto.randomUUID(), ...values, isDemo: false },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      setOpen(false);
    } catch (cause) {
      form.setError("root", {
        message: cause instanceof Error ? cause.message : "保存失败",
      });
    }
  }
  async function importImage(row:ImageReportDraft):Promise<boolean|void>{
    if(row.kind!=="advertising")return false;
    const existing=data!.advertising.find(item=>item.date===row.date);
    if(existing?.source==="mock_pinduoduo"||existing?.source==="official_pinduoduo")throw new Error("该日期已有平台同步推广数据，请勿用截图覆盖。");
    if(existing&&!window.confirm(`${row.date} 已有推广数据，确认用截图识别值替换吗？`))return false;
    const parsed=schema.parse({date:row.date,spend:row.spend,attributedSales:row.attributedSales,attributedOrders:Number(row.attributedOrders)});
    await update(current=>({...current,advertising:[...current.advertising.filter(item=>item.date!==row.date),{id:existing?.id||crypto.randomUUID(),...parsed,isDemo:false,source:"image_import" as const}].sort((a,b)=>a.date.localeCompare(b.date))}));
  }
  return (
    <>
      <PageHead
        eyebrow="PERFORMANCE / 推广分析"
        title="让每一笔推广费更清楚"
        description="广告效果以归因成交额衡量，与全店销售额分开核算。"
        action={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button onClick={() => edit()}>
                    <Plus size={17} />
                    录入推广数据
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "编辑" : "录入"}推广数据</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit(save)}
                  className="space-y-4 pt-3"
                >
                  <div>
                    <Label htmlFor="ad-date">日期</Label>
                    <Input
                      id="ad-date"
                      type="date"
                      className="mt-2"
                      {...form.register("date")}
                    />
                    <p className="text-xs text-red-500">
                      {form.formState.errors.date?.message}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ad-spend">广告消耗（元）</Label>
                    <Input
                      id="ad-spend"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-2"
                      {...form.register("spend")}
                    />
                    <p className="text-xs text-red-500">
                      {form.formState.errors.spend?.message}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ad-sales">广告归因成交额（元）</Label>
                    <Input
                      id="ad-sales"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-2"
                      {...form.register("attributedSales")}
                    />
                    <p className="text-xs text-red-500">
                      {form.formState.errors.attributedSales?.message}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ad-orders">广告归因订单量</Label>
                    <Input
                      id="ad-orders"
                      type="number"
                      min="0"
                      step="1"
                      className="mt-2"
                      {...form.register("attributedOrders", {
                        valueAsNumber: true,
                      })}
                    />
                    <p className="text-xs text-red-500">
                      {form.formState.errors.attributedOrders?.message}
                    </p>
                  </div>
                  <p className="text-xs text-[#8296a9]">
                    请填写广告平台报告中的归因成交额，勿填全店成交额。
                  </p>
                  {form.formState.errors.root?.message && (
                    <p role="alert" className="text-sm text-[#e85d65]">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? "保存中…" : "保存数据"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <AiInsightPanel feature="advertising" context={{ days, adSpend: Number(summary.adSpend), attributedRevenue: Number(addMoney(ads.map(row => row.attributedSales))), attributedOrders: ads.reduce((sum, row) => sum + (row.attributedOrders || 0), 0), roas: summary.roas ?? "数据不足", breakEvenRoas: summary.breakEvenRoas ?? "成本数据不足", totalStoreSales: Number(summary.netSales) }} />
      <div className="mb-5"><ReportImageImport defaultDate={storeToday(data.settings.store.timezone)} disabled={!canEdit} onImport={importImage}/></div>
      <div className="mb-5 flex gap-2">
        {([7, 30] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={days === v ? "default" : "outline"}
            onClick={() => setDays(v)}
          >
            近 {v} 天
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="广告消耗"
          value={formatMoney(summary.adSpend)}
          icon={<Wallet size={18} />}
        />
        <MetricCard
          label="广告归因成交额"
          value={formatMoney(attributed)}
          icon={<TrendingUp size={18} />}
        />
        <MetricCard
          label="广告 ROAS"
          value={numeric(summary.roas, "x")}
          sub="归因成交额 ÷ 广告消耗"
          icon={<Target size={18} />}
        />
        <MetricCard
          label="盈亏平衡 ROAS（估算）"
          value={numeric(summary.breakEvenRoas, "x")}
          sub="依据完整成本及全店贡献率估算"
          icon={<Ratio size={18} />}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title="推广趋势"
          sub="广告消耗与归因成交额；悬停查看具体数值"
        >
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adTrend} margin={{ left: -15, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#edf3f9" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9aabba" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9aabba" }}
                />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Bar
                  isAnimationActive={false}
                  dataKey="spend"
                  name="广告消耗"
                  fill="#9bcdf6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="attributedSales"
                  name="归因成交额"
                  fill="#3b91eb"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="推广效率分析" sub="用于判断投入产出与成本安全线">
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#f2f9ff] p-5">
              <p className="text-xs text-[#7894ae]">投入产出状态</p>
              <p className="mt-2 text-lg font-bold">
                {summary.roas === null
                  ? "暂无广告消耗"
                  : summary.breakEvenRoas === null
                    ? "成本数据不足，暂无法判断"
                    : summary.roas >= summary.breakEvenRoas
                      ? "高于估算盈亏平衡线"
                      : "低于估算盈亏平衡线"}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#8296a9]">
                估算盈亏平衡 ROAS = 1 ÷（1 − 非广告成本 ÷
                净销售额）。该指标使用全店平均贡献率，仅供经营参考。
              </p>
            </div>
            <p className="text-xs leading-5 text-[#8a9eb0]">
              广告 ROAS
              仅使用录入的广告归因成交额。净利润仍以全店实际销售额和费用汇总计算。
            </p>
          </div>
        </SectionCard>
      </div>
      <SectionCard
        className="mt-5"
        title="推广记录"
        sub="每个日期一条记录，点击编辑可修正数据"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b text-xs text-[#90a2b3]">
              <tr>
                <th className="py-3">日期</th>
                <th>广告消耗</th>
                <th>归因成交额</th>
                <th>ROAS</th>
                <th>来源</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {[...ads].reverse().map((ad) => (
                <tr
                  key={ad.id}
                  className="border-b border-[#edf2f7] last:border-0"
                >
                  <td className="py-3 font-medium">{ad.date}</td>
                  <td>{formatMoney(ad.spend)}</td>
                  <td>{formatMoney(ad.attributedSales)}</td>
                  <td>{adRoas([ad]) !== null ? adRoas([ad]) + "x" : "—"}</td>
                  <td className="text-xs text-[#8ca0b2]">
                    {ad.isDemo ? "模拟数据" : ad.source === "image_import" ? "截图识别" : ad.source === "csv_import" ? "CSV 导入" : "手动录入"}
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => edit(ad)}
                      disabled={!canEdit}
                    >
                      <Pencil size={14} />
                      编辑
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
