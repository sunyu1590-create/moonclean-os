"use client";
import { useRef, useState } from "react";
import { FileImage, LoaderCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/common";
export type ImageReportDraft={
  kind:"daily"|"advertising";date:string;sales:string;refunds:string;orders:string;
  spend:string;attributedSales:string;attributedOrders:string;rawText:string;
};
function findValue(lines:string[],labels:string[]):string{
  for(const line of lines){
    if(!labels.some(label=>line.includes(label)))continue;
    const match=line.replace(/[,，]/g,"").match(/(?:￥|¥)?\s*(\d+(?:\.\d+)?)\s*(万)?/);
    if(match){const value=Number(match[1])*(match[2]?10000:1);return Number.isFinite(value)?value.toFixed(2):"";}
  }
  return "";
}
function parseDate(text:string,fallback:string){
  const match=text.match(/(20\d{2})\s*[年\-/ .]\s*(\d{1,2})\s*[月\-/ .]\s*(\d{1,2})\s*日?/);
  return match?`${match[1]}-${match[2].padStart(2,"0")}-${match[3].padStart(2,"0")}`:fallback;
}
export function ReportImageImport({defaultDate,onImport,disabled=false}:{defaultDate:string;onImport:(draft:ImageReportDraft)=>Promise<void|boolean>;disabled?:boolean}){
  const fileRef=useRef<HTMLInputElement>(null);
  const [kind,setKind]=useState<"daily"|"advertising">("daily");
  const [draft,setDraft]=useState<ImageReportDraft|null>(null);const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  async function recognize(file:File,kind:"daily"|"advertising"){
    setBusy(true);setError("");setNotice("");setProgress(0);
    try{
      const {createWorker}=await import("tesseract.js");
      const worker=await createWorker("chi_sim+eng",1,{logger:message=>setProgress(Math.round(message.progress*100))});
      try{
        const result=await worker.recognize(file);const raw=result.data.text;
        const lines=raw.split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean);
        const spend=findValue(lines,["推广消耗","广告消耗","消耗金额","推广花费","广告花费"]);
        const attributedSales=findValue(lines,["广告归因成交额","推广归因成交额","广告成交金额","推广成交金额","广告成交额","推广成交额","直接成交金额","直接成交额"]);
        const attributedOrders=findValue(lines,["推广订单数","广告订单数","推广成交订单数","广告成交订单数","直接成交订单数"]);
        const sales=findValue(lines,["销售额","店铺成交额","成交金额","成交总额","成交额","支付金额"]);
        const refunds=findValue(lines,["退款金额","售后退款","退款总额","退款"]);
        const orders=findValue(lines,["支付订单数","成交订单数","订单数","订单量"]);
        setDraft({kind,date:parseDate(raw,defaultDate),sales,refunds,orders,spend,attributedSales,attributedOrders,rawText:raw});
      }finally{await worker.terminate();}
      setNotice("识别完成，请核对每个字段；确认前不会写入经营数据。");
    }catch(cause){setError(cause instanceof Error?`图片识别失败：${cause.message}`:"图片识别失败，请换一张清晰截图重试。")}
    finally{setBusy(false);if(fileRef.current)fileRef.current.value="";}
  }
  async function confirm(){
    if(!draft)return;
    const valid=draft.kind==="daily"?draft.sales!==""&&draft.refunds!==""&&draft.orders!=="":draft.spend!==""&&draft.attributedSales!==""&&draft.attributedOrders!=="";
    if(!valid){setError("识别字段不完整，请手动补齐高亮字段后再导入。");return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)){setError("请选择有效日期。");return;}
    setBusy(true);setError("");
    try{const imported=await onImport(draft);if(imported===false){setNotice("已取消覆盖，原数据保持不变。");return;}setDraft(null);setNotice("图片识别数据已导入。");}
    catch(cause){setError(cause instanceof Error?cause.message:"导入失败");}
    finally{setBusy(false);}
  }
  type DraftField=Exclude<keyof ImageReportDraft,"kind"|"rawText">;
  const edit=(key:DraftField,value:string)=>setDraft(current=>current?({...current,[key]:value}):current);
  return <SectionCard title="拼多多报表截图录入" sub="不用手动逐项填写：上传经营报表或推广报表截图，识别后核对并保存">
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium" htmlFor="report-kind">报表类型</label><select id="report-kind" disabled={busy||!!draft} className="h-10 rounded-xl border border-[#e3eaf1] bg-white px-3 text-sm disabled:opacity-60" value={draft?.kind||kind} onChange={e=>setKind(e.target.value as "daily"|"advertising")}><option value="daily">经营报表</option><option value="advertising">推广报表</option></select><Button type="button" disabled={disabled||busy} className="min-h-11 px-5 shadow-sm" onClick={()=>fileRef.current?.click()}><FileImage size={17}/>{busy?<><LoaderCircle size={16} className="animate-spin"/>正在识别 {progress}%</>:<><ScanLine size={17}/>上传报表截图开始识别</>}</Button><input ref={fileRef} id="report-image" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void recognize(file,kind);}}/></div>
    {disabled&&<p className="mt-3 text-xs text-[#8999a9]">当前账号只有查看权限，无法导入数据。</p>}
    <p className="mt-3 text-xs leading-5 text-[#8999a9]">图片和识别内容仅在当前浏览器处理，不会上传至 MoonClean 服务器。首次使用会从 jsDelivr 下载 OCR 引擎和中文识别模型；识别后请逐项核对。推广归因金额只自动识别带“广告 / 推广 / 直接成交”字样的字段，普通“成交额”不会自动填入 ROAS。</p>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-[#fff0f1] p-3 text-sm text-[#d35760]">{error}</p>}{notice&&!error&&<p role="status" className="mt-3 text-sm text-[#16866f]">{notice}</p>}
    {draft&&<div className="mt-5 rounded-2xl border border-[#e7edf3] bg-[#fafcfe] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8999a9]"><span>当前预览：{draft.kind==="daily"?"经营报表":"推广报表"}</span><button type="button" className="text-[#287fe2]" onClick={()=>setDraft(null)}>重新选择报表类型</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><label className="text-xs text-[#7a8a9b]">报表日期</label><Input type="date" className="mt-1" value={draft.date} onChange={e=>edit("date",e.target.value)}/></div>
      {(draft.kind==="daily"?[["sales","店铺销售额"],["refunds","退款金额"],["orders","订单数"]]:[["spend","广告消耗"],["attributedSales","广告归因成交额"],["attributedOrders","广告归因订单数"]]).map(([key,label])=><div key={key}><label className="text-xs text-[#7a8a9b]">{label}</label><Input inputMode="decimal" className={`mt-1 ${draft[key as DraftField]===""?"border-[#e85d65]":""}`} value={draft[key as DraftField]} onChange={e=>edit(key as DraftField,e.target.value)} placeholder="请核对或补填"/></div>)}
    </div><details className="mt-3"><summary className="cursor-pointer text-xs text-[#7a8a9b]">查看 OCR 原文</summary><pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-[#758597]">{draft.rawText}</pre></details><Button className="mt-4" disabled={busy} onClick={()=>void confirm()}>核对无误，导入这一天</Button></div>}
  </SectionCard>;
}
