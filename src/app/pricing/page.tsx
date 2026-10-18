"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { AppSelect } from "@/components/ui/app-select";
import { Calculator, CircleHelp, Plus, RotateCcw, Target, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance";
import { calculatePricing, isMoneyInput, isRateInput } from "@/lib/pricing";
import type { SKUCost } from "@/lib/model";

type TemporarySku = { name: string; skuName: string; price: string; cost: SKUCost };
const zeroCost = (): SKUCost => ({ production: "0.00", packaging: "0.00", logistics: "0.00", platform: "0.00" });
const costFields: { key: keyof SKUCost; label: string }[] = [
  { key: "production", label: "生产成本" },
  { key: "packaging", label: "包装成本" },
  { key: "logistics", label: "物流成本" },
  { key: "platform", label: "平台费用" },
];

export default function PricingPage() {
  const { data } = useApp();
  const skus = useMemo(() => data?.products.flatMap((product) => product.skus.map((sku) => ({ product, sku }))) || [], [data]);
  const [skuId, setSkuId] = useState("");
  const [price, setPrice] = useState("");
  const [feeRate, setFeeRate] = useState("0");
  const [targetMargin, setTargetMargin] = useState("20");
  const [tempDraft, setTempDraft] = useState<TemporarySku | null>(null);
  const [tempSku, setTempSku] = useState<TemporarySku | null>(null);
  const [tempError, setTempError] = useState("");
  const [inputError, setInputError] = useState("");

  if (!data) return <p>正在读取定价工具…</p>;
  const selected = skus.find((item) => item.sku.id === skuId) || (skuId === "" ? skus[0] : undefined);
  const current = skuId === "temporary" ? tempSku : selected?.sku;
  const currentName = skuId === "temporary" && tempSku ? `${tempSku.name} · ${tempSku.skuName}` : selected ? `${selected.product.name} · ${selected.sku.name}` : "";
  const priceValue = price || current?.price || "";
  const rateValid = isRateInput(feeRate, 99.99);
  const marginValid = isRateInput(targetMargin, 99.99) && Number(targetMargin) < 100;
  const priceValid = isMoneyInput(priceValue) && Number(priceValue) > 0;
  const costComplete = !!current && Object.values(current.cost).every((value) => isMoneyInput(String(value)));
  const result = current && costComplete && priceValid && rateValid && marginValid
    ? calculatePricing({ price: priceValue, cost: current.cost, variableFeeRate: feeRate, targetMargin })
    : null;
  const contributionPercent = result?.margin?.toFixed(1) ?? "—";

  function choose(id: string) {
    setSkuId(id);
    setPrice(id === "temporary" ? tempSku?.price || "" : skus.find((item) => item.sku.id === id)?.sku.price || "");
    setInputError("");
  }
  function startTemporarySku() {
    const baseCost = current?.cost || zeroCost();
    const draft = { name: "临时商品", skuName: "临时规格", price: current?.price || "29.90", cost: { ...baseCost } };
    setTempDraft(draft);
    setTempError("");
  }
  function saveTemporarySku() {
    if (!tempDraft?.name.trim() || !tempDraft.skuName.trim()) {
      setTempError("请填写商品名称和规格名称。");
      return;
    }
    if (!isMoneyInput(tempDraft.price) || Number(tempDraft.price) <= 0 || !Object.values(tempDraft.cost).every((value) => isMoneyInput(value))) {
      setTempError("售价需大于 0，成本填写有效金额（可填 0，最多两位小数）。");
      return;
    }
    setTempSku({ ...tempDraft, name: tempDraft.name.trim(), skuName: tempDraft.skuName.trim() });
    setSkuId("temporary");
    setPrice(tempDraft.price);
    setTempDraft(null);
    setTempError("");
    setInputError("");
  }
  function pressKey(key: string) {
    setPrice((currentValue) => {
      if (key === "清空") return "";
      if (key === "退格") return currentValue.slice(0, -1);
      if (key === ".") return currentValue.includes(".") ? currentValue : `${currentValue || "0"}.`;
      const next = `${currentValue}${key}`;
      const decimalPart = next.split(".")[1];
      return decimalPart && decimalPart.length > 2 ? currentValue : next;
    });
    setInputError("");
  }
  function updateTemp<K extends keyof TemporarySku>(key: K, value: TemporarySku[K]) {
    setTempDraft((draft) => draft ? { ...draft, [key]: value } : draft);
  }
  function updateTempCost(key: keyof SKUCost, value: string) {
    setTempDraft((draft) => draft ? { ...draft, cost: { ...draft.cost, [key]: value } } : draft);
  }

  return <>
    <PageHead eyebrow="PRICING LAB / 定价模拟" title="先算清每件商品能留下多少" description="可选择在售 SKU，也可临时创建一条规格试算；临时 SKU 和模拟价格都不会写入商品或云端数据。" />
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e2edf7] bg-white p-3 shadow-[0_4px_16px_rgba(40,73,105,.04)]">
      <label htmlFor="pricing-sku" className="shrink-0 text-xs font-semibold text-[#61778c]">计算对象</label>
      <AppSelect id="pricing-sku" className="h-9 min-w-0 flex-1 rounded-xl border border-[#e3eaf1] bg-white px-3 text-xs sm:max-w-md sm:text-sm" value={skuId === "temporary" ? "temporary" : current && "id" in current ? current.id : ""} onChange={(event) => choose(event.target.value)}>
        <option value="">选择商品规格</option>
        {skus.map(({ product, sku }) => <option key={sku.id} value={sku.id}>{product.name} · {sku.name}</option>)}
        {tempSku && <option value="temporary">临时 SKU · {tempSku.name} · {tempSku.skuName}</option>}
      </AppSelect>
      <Button type="button" variant="outline" size="sm" onClick={startTemporarySku}><Plus size={15}/>临时 SKU</Button>
      {skuId === "temporary" && <Button type="button" variant="ghost" size="sm" aria-label="清除临时 SKU" onClick={() => { setTempSku(null); setTempDraft(null); setSkuId(""); setPrice(""); }}><Trash2 size={15}/></Button>}
    </div>

    {tempDraft && <SectionCard title="创建临时 SKU" sub="只在本次页面计算时使用，刷新页面后不会保存。">
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledInput label="临时商品名称" value={tempDraft.name} onChange={(value) => updateTemp("name", value)} placeholder="例如：新品试算" />
        <LabeledInput label="规格名称" value={tempDraft.skuName} onChange={(value) => updateTemp("skuName", value)} placeholder="例如：家庭装" />
        <LabeledInput label="预设售价（元）" value={tempDraft.price} onChange={(value) => updateTemp("price", value)} inputMode="decimal" />
        {costFields.map((field) => <LabeledInput key={field.key} label={`${field.label}（元/件）`} value={tempDraft.cost[field.key]} onChange={(value) => updateTempCost(field.key, value)} inputMode="decimal" />)}
      </div>
      {tempError && <p role="alert" className="mt-3 rounded-xl bg-[#fff0f1] p-3 text-xs text-[#d35760]">{tempError}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setTempDraft(null)}>取消</Button><Button type="button" onClick={saveTemporarySku}>开始试算</Button></div>
    </SectionCard>}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
      <SectionCard title="试算输入" sub={currentName ? `当前计算：${currentName}${skuId === "temporary" ? " · 仅本机临时数据" : " · 使用商品管理中的成本"}` : "先选择商品 SKU，或创建临时 SKU。"}>
        {!current ? <div className="rounded-2xl border border-dashed border-[#dbe8f3] bg-[#f8fbfe] px-4 py-9 text-center text-sm text-[#8194a8]">选择一条 SKU 开始计算，也可以添加临时 SKU。</div> : <div className="space-y-4">
          <div className="rounded-2xl border border-[#d9eafa] bg-[linear-gradient(135deg,#f0f8ff,#fff)] p-3 sm:p-4">
            <div className="flex items-end justify-between gap-2"><div><label htmlFor="pricing-price" className="text-xs font-semibold text-[#6d849a]">模拟成交价</label><div className="mt-1 flex items-baseline gap-1"><span className="text-sm text-[#7591aa]">¥</span><Input id="pricing-price" type="text" inputMode="decimal" value={priceValue} onChange={(event) => { if (/^\d*(\.\d{0,2})?$/.test(event.target.value)) { setPrice(event.target.value); setInputError(""); } }} className="h-11 w-36 border-0 bg-transparent px-0 text-3xl font-bold tracking-tight text-[#172b45] shadow-none focus-visible:ring-0 sm:text-4xl" aria-describedby="pricing-current-price" /></div></div><div className="pb-1 text-right"><p className="text-[10px] text-[#91a1b0]">商品原售价</p><strong id="pricing-current-price" className="text-sm text-[#536c82]">{formatMoney(current.price)}</strong></div></div>
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2">
              {["7", "8", "9", "退格", "4", "5", "6", "清空", "1", "2", "3", ".", "0", "00"].map((key) => <Button key={key} type="button" variant={key === "清空" ? "ghost" : "outline"} size="sm" className={`h-9 rounded-xl px-1 text-xs sm:h-10 sm:text-sm ${key === "退格" || key === "清空" ? "text-[#6d8296]" : "border-[#e5edf4] bg-white text-[#263d54]"}`} onClick={() => pressKey(key)}>{key}</Button>)}
              <Button type="button" variant="outline" size="sm" className="col-span-2 h-9 rounded-xl text-xs sm:col-span-2 sm:h-10 sm:text-sm" onClick={() => { setPrice(current.price); setInputError(""); }}><RotateCcw size={13}/>恢复售价</Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="额外比例费用（%）" value={feeRate} onChange={(value) => { setFeeRate(value); setInputError(""); }} inputMode="decimal" hint="例如活动扣点；广告支出单独按 ROAS 估算。" />
            <LabeledInput label="目标贡献利润率（%）" value={targetMargin} onChange={(value) => { setTargetMargin(value); setInputError(""); }} inputMode="decimal" hint="根据成本反推建议售价。" />
          </div>
          {inputError && <p role="alert" className="rounded-xl bg-[#fff0f1] p-3 text-xs text-[#d35760]">{inputError}</p>}
          {(!rateValid || !marginValid || !priceValid) && <p className="rounded-xl bg-[#fff8ee] p-3 text-xs leading-5 text-[#9a774b]">售价需大于 0；费用比例与目标利润率需填写 0–99.99 的有效数字。</p>}
        </div>}
      </SectionCard>

      <SectionCard title="单件利润拆解" sub="每项金额都以当前售价和已录入成本实时计算。">
        {!current ? <p className="rounded-xl bg-[#f7f9fb] p-4 text-sm text-[#8999a9]">选好 SKU 后，这里会即时展示利润与费用结构。</p> : !costComplete ? <p className="rounded-xl bg-[#fff8f1] p-4 text-sm text-[#a77743]">此 SKU 缺少完整成本数据。请到商品管理补齐成本，或改用临时 SKU 输入成本后试算。</p> : result ? <>
          <div className={`rounded-2xl border p-4 ${result.contribution.gte(0) ? "border-[#d5eee6] bg-[linear-gradient(135deg,#effaf6,#fff)]" : "border-[#f5d8da] bg-[#fff4f4]"}`}>
            <p className="text-xs font-medium text-[#7f92a4]">预计每售出一件，扣除以下成本后可贡献</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><strong className={`number text-3xl font-bold tracking-tight ${result.contribution.gte(0) ? "text-[#139778]" : "text-[#d94d58]"}`}>{formatMoney(result.contribution.toFixed(2))}</strong><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#678096]">利润率 {contributionPercent}%</span></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MetricCard label="目标利润售价" value={result.targetPrice ? formatMoney(result.targetPrice.toDecimalPlaces(2, Decimal.ROUND_CEIL).toFixed(2)) : "目标不可达"} icon={<Target size={17}/>} sub={`贡献利润率 ${targetMargin}%`} />
            <MetricCard label="盈亏平衡 ROAS" value={result.breakEvenRoas ? `${result.breakEvenRoas.toFixed(2)}x` : "无法达到"} icon={<Calculator size={17}/>} sub="售价 ÷ 可用于广告的贡献额" />
          </div>
          <div className="mt-3 space-y-2 rounded-2xl border border-[#edf1f5] bg-[#fafcfe] p-3 sm:p-4">
            <BreakdownRow label="成交售价" value={result.price.toFixed(2)} tone="blue" />
            {costFields.map((field) => <BreakdownRow key={field.key} label={field.label} value={result[field.key === "production" ? "productCost" : field.key === "packaging" ? "packagingCost" : field.key === "logistics" ? "shippingCost" : "platformCost"].toFixed(2)} />)}
            <BreakdownRow label={`比例费用（${feeRate}%）`} value={result.variableCost.toFixed(2)} />
            <div className="border-t border-dashed border-[#dce5ec] pt-2"><BreakdownRow label="单件贡献利润" value={result.contribution.toFixed(2)} tone={result.contribution.gte(0) ? "green" : "red"} /></div>
          </div>
        </> : <p className="rounded-xl bg-[#f7f9fb] p-4 text-sm text-[#8999a9]">请检查价格、费用比例和目标利润率后查看计算结果。</p>}
      </SectionCard>
    </div>
    <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-5 text-[#8b9aaa]"><CircleHelp className="mt-0.5 size-3.5 shrink-0"/>试算仅为单件贡献估算，不包括未录入的仓储、税费及其他费用；盈亏平衡 ROAS 不代表实际广告效果。</p>
  </>;
}

function LabeledInput({ label, value, onChange, placeholder, inputMode, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "decimal" | "text"; hint?: string }) {
  return <label className="block min-w-0 text-xs font-medium text-[#526b82]">{label}<Input type="text" inputMode={inputMode || "text"} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-9 rounded-xl text-xs sm:h-10 sm:text-sm" />{hint && <small className="mt-1 block text-[9px] font-normal leading-4 text-[#92a1af]">{hint}</small>}</label>;
}

function BreakdownRow({ label, value, tone }: { label: string; value: string; tone?: "blue" | "green" | "red" }) {
  const valueColor = tone === "blue" ? "text-[#347fc1]" : tone === "green" ? "text-[#149879]" : tone === "red" ? "text-[#d94d58]" : "text-[#657a8e]";
  return <div className="flex items-center justify-between gap-3 text-xs"><span className="text-[#7d8e9e]">{label}</span><span className={`number font-semibold ${valueColor}`}>{formatMoney(value)}</span></div>;
}
