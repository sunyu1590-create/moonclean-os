"use client";
import { useMemo, useState } from "react";
import { ClipboardPaste, TableProperties } from "lucide-react";
import { z } from "zod";
import Decimal from "decimal.js";
import type { DailyMetric } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/common";
export type QuickDailyRow={date:string;sales:string;refunds:string;orders:number;productCost:string;packagingCost:string;logisticsCost:string;platformFees:string;otherExpenses:string};
const money=z.string().regex(/^\d+(\.\d{1,2})?$/);
const rowSchema=z.object({date:z.iso.date(),sales:money,refunds:money,orders:z.number().int().nonnegative(),productCost:money.or(z.literal("")),packagingCost:money.or(z.literal("")),logisticsCost:money.or(z.literal("")),platformFees:money.or(z.literal("")),otherExpenses:money.or(z.literal(""))}).refine(row=>new Decimal(row.refunds).lte(row.sales),{message:"退款不能高于销售额"});
function normalizeDate(value:string){
  const text=value.trim().replace(/[年月]/g,"-").replace(/日/g,"").replaceAll("/","-").replaceAll(".","-");
  const match=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match?`${match[1]}-${match[2].padStart(2,"0")}-${match[3].padStart(2,"0")}`:text;
}
function normalizeMoney(value:string){
  const text=value.trim().replace(/[¥￥$,，\s]/g,"");
  return ["","—","-","/"].includes(text)?"":text;
}
function parseRows(input:string){
  const errors:string[]=[];const rows:QuickDailyRow[]=[];const seen=new Set<string>();
  const lines=input.split(/\r?\n/).map((line,index)=>({line,index:index+1})).filter(item=>item.line.trim());
  for(const item of lines){
    const columns=item.line.split("\t").map(value=>value.trim());
    if(item.index===1&&/date|日期/i.test(columns[0]))continue;
    if(columns.length<4||columns.length>9){errors.push(`第 ${item.index} 行需要 4 至 9 列：日期、销售额、退款、订单数，后面成本列可选。`);continue;}
    const candidate={date:normalizeDate(columns[0]),sales:normalizeMoney(columns[1]),refunds:normalizeMoney(columns[2]),orders:columns[3].trim()===""?Number.NaN:Number(columns[3].replaceAll(",","")),
      productCost:normalizeMoney(columns[4]||""),packagingCost:normalizeMoney(columns[5]||""),logisticsCost:normalizeMoney(columns[6]||""),
      platformFees:normalizeMoney(columns[7]||""),otherExpenses:normalizeMoney(columns[8]||"")};
    const parsed=rowSchema.safeParse(candidate);
    if(!parsed.success){errors.push(`第 ${item.index} 行：${parsed.error.issues[0]?.message||"字段格式错误"}`);continue;}
    if(seen.has(parsed.data.date)){errors.push(`第 ${item.index} 行：日期 ${parsed.data.date} 重复。`);continue;}
    seen.add(parsed.data.date);rows.push(parsed.data);
  }
  return {rows,errors};
}
export function QuickMetricEntry({rows:existing,disabled=false,onImport}:{rows:DailyMetric[];disabled?:boolean;onImport:(rows:QuickDailyRow[],overwrite:boolean)=>Promise<void|boolean>}){
  const [text,setText]=useState("");const [preview,setPreview]=useState<ReturnType<typeof parseRows>|null>(null);
  const [overwrite,setOverwrite]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const dates=useMemo(()=>new Set(existing.map(row=>row.date)),[existing]);
  const duplicates=preview?.rows.filter(row=>dates.has(row.date))||[];
  const protectedDate=duplicates.some(row=>existing.some(old=>old.date===row.date&&(old.source==="mock_pinduoduo"||old.source==="official_pinduoduo")));
  function inspect(){setError("");setNotice("");setOverwrite(false);const result=parseRows(text);setPreview(result);if(!result.rows.length&&!result.errors.length)setError("请先粘贴至少一行数据。");}
  async function confirm(){
    if(!preview||preview.errors.length||!preview.rows.length)return;
    setBusy(true);setError("");setNotice("");
    try{const result=await onImport(preview.rows,overwrite);if(result===false){setNotice("已取消，本地和云端记录未变化。");return;}setText("");setPreview(null);setNotice(`已导入 ${preview.rows.length} 天经营数据。`);}
    catch(cause){setError(cause instanceof Error?cause.message:"导入失败");}
    finally{setBusy(false);}
  }
  return <SectionCard title="表格粘贴批量录入" sub="从 Excel 或拼多多报表复制多行，再粘贴到这里">
    <label htmlFor="quick-daily-paste" className="mb-2 block text-sm font-medium">粘贴数据</label>
    <textarea id="quick-daily-paste" value={text} onChange={e=>setText(e.target.value)} disabled={disabled} placeholder={"每行一日，按 Tab 分列：日期｜销售额｜退款｜订单数｜商品成本｜包装｜物流｜平台费｜其他费用\n例如：2026-10-18\t2380.50\t120\t36\t900\t60\t90\t110\t20\n前四列必填；缺少成本请留空，系统会标记利润数据不完整。"} className="min-h-32 w-full resize-y rounded-2xl border border-[#e3eaf1] bg-white p-4 text-xs leading-6 text-[#34465b] outline-none focus:border-[#8dc2fa]"/>
    <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled||!text.trim()} onClick={inspect}><TableProperties size={16}/>预览数据</Button>{preview&&<Button type="button" disabled={disabled||busy||!preview.rows.length||!!preview.errors.length||protectedDate||duplicates.length>0&&!overwrite} onClick={()=>void confirm()}><ClipboardPaste size={16}/>{busy?"导入中…":`确认导入 ${preview.rows.length} 天`}</Button>}</div>
    {error&&<p role="alert" className="mt-3 text-sm text-[#d35760]">{error}</p>}{notice&&<p role="status" className="mt-3 text-sm text-[#16866f]">{notice}</p>}
    {preview&&<div className="mt-4 rounded-2xl border border-[#e7edf3] p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>导入预览 · {preview.rows.length} 行有效</strong>{duplicates.length>0&&<label className="flex items-center gap-2 text-xs text-[#9c6c43]"><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/>覆盖 {duplicates.length} 条同日期手工记录</label>}</div>
      {protectedDate&&<p className="mt-2 text-xs text-[#d35760]">其中包含平台同步日期，不能覆盖这些数据。</p>}
      {preview.errors.length>0&&<ul className="mt-3 space-y-1 text-xs text-[#d35760]">{preview.errors.map((message,index)=><li key={index}>{message}</li>)}</ul>}
      {!!preview.rows.length&&<div className="mt-3 max-h-56 overflow-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="sticky top-0 bg-white text-[#8999a9]"><tr>{["日期","销售额","退款","订单","成本状态"].map(label=><th key={label} className="py-2">{label}</th>)}</tr></thead><tbody>{preview.rows.map(row=><tr key={row.date} className="border-t border-[#eef1f4]"><td className="py-2">{row.date}</td><td>{row.sales}</td><td>{row.refunds}</td><td>{row.orders}</td><td>{[row.productCost,row.packagingCost,row.logisticsCost,row.platformFees].every(Boolean)?"已录入":"不完整（导入时保留已有成本）"}</td></tr>)}</tbody></table></div>}
    </div>}
  </SectionCard>;
}
