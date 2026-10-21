"use client";
import { AppSelect } from "@/components/ui/app-select";

import { useRef, useState } from "react";
import { FileImage, LoaderCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/common";
import { adRoas } from "@/lib/finance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  detectPinduoduoReportKind,
  parsePinduoduoReportText,
} from "@/lib/report-ocr";

export type ImageReportDraft = {
  kind: "daily" | "advertising";
  date: string;
  sales: string;
  refunds: string;
  orders: string;
  spend: string;
  attributedSales: string;
  netAttributedSales: string;
  attributedOrders: string;
  buyers: string;
  averageOrderValue: string;
  visitors: string;
  conversionRate: string;
  refundOrders: string;
  visitorValue: string;
  rawText: string;
};

type EditableField = Exclude<keyof ImageReportDraft, "kind" | "rawText">;

export function ReportImageImport({
  defaultDate,
  onImport,
  disabled = false,
}: {
  defaultDate: string;
  onImport: (draft: ImageReportDraft) => Promise<void | boolean>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"daily" | "advertising">("daily");
  const [draft, setDraft] = useState<ImageReportDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);

  async function recognize(file: File, selectedKind: "daily" | "advertising") {
    setBusy(true);
    setDraft(null);
    setFeedback(null);
    setError("");
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim+eng", 1, {
        logger: (message) => setProgress(Math.round(message.progress * 100)),
      });
      try {
        const result = await worker.recognize(file);
        const rawText = result.data.text;
        const detectedKind = detectPinduoduoReportKind(rawText);
        setDraft({
          kind: detectedKind === "advertising" ? detectedKind : selectedKind,
          ...parsePinduoduoReportText(rawText, defaultDate),
          rawText,
        });
      } finally {
        await worker.terminate();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "请换一张清晰截图重试。";
      setFeedback({
        title: "图片识别失败",
        message: /Cannot find module.*tesseract\.js/i.test(message)
          ? "识别组件尚未安装。请在 Codespaces 终端运行 npm install，完成后重启开发服务器。"
          : message,
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirm() {
    if (!draft) return;
    const required = draft.kind === "daily"
      ? [draft.sales, draft.refunds, draft.orders]
      : [draft.spend, draft.attributedSales, draft.attributedOrders];
    if (required.some((value) => value === "")) {
      setError("必填数据未识别，请在下方补齐标红字段后再保存。");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setError("请选择有效的报表日期。");
      return;
    }
    const countFields: [EditableField, string][] = draft.kind === "daily"
      ? [["orders", "成交订单数"], ["buyers", "成交买家数"], ["visitors", "商品访客数"], ["refundOrders", "退款单数"]]
      : [["attributedOrders", "广告归因订单数"]];
    const invalidCount = countFields.find(([key]) => {
      const value = draft[key];
      return value !== "" && !Number.isSafeInteger(Number(value));
    });
    if (invalidCount) {
      setError(`${invalidCount[1]}需要填写整数，请核对识别结果。`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const imported = await onImport(draft);
      if (imported === false) {
        if (draft.kind === "advertising") {
          setDraft(null);
          setFeedback({
            title: "推广截图已识别",
            message: "目前可以识别并核对推广报表，自动保存功能尚未开通。请前往推广分析页面录入数据。",
          });
          return;
        }
        setError("已取消覆盖，原有数据保持不变。");
        return;
      }
      setDraft(null);
      setFeedback({ title: "录入成功", message: `${draft.date} 的截图数据已保存。` });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  }

  function edit(key: EditableField, value: string) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  const fields: [EditableField, string][] = draft?.kind === "daily"
    ? [["sales", "成交金额"], ["refunds", "昨日退款金额"], ["orders", "成交订单数"], ["buyers", "成交买家数"], ["averageOrderValue", "客单价"], ["visitors", "商品访客数"], ["conversionRate", "成交转化率（%）"], ["refundOrders", "昨日退款单数"], ["visitorValue", "昨日访客价值"]]
    : [["spend", "总花费 / 成交花费（元）"], ["attributedSales", "交易额（元）"], ["netAttributedSales", "净交易额（元，可选）"], ["attributedOrders", "净成交笔数"]];
  const requiredKeys = draft?.kind === "daily"
    ? ["sales", "refunds", "orders"]
    : ["spend", "attributedSales", "attributedOrders"];
  const validPreviewMoney = (value: string) => /^\d+(\.\d{1,2})?$/.test(value);
  const previewRoas = draft?.kind === "advertising" &&
      validPreviewMoney(draft.spend) && validPreviewMoney(draft.attributedSales)
    ? adRoas([{
        id: "image-preview",
        date: draft.date,
        spend: draft.spend,
        attributedSales: draft.attributedSales,
        attributedOrders: Number(draft.attributedOrders) || 0,
      }])
    : null;

  return (
    <>
      <SectionCard title="拼多多报表截图录入" sub="上传经营报表或推广报表截图，识别后在弹窗中核对并保存">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium" htmlFor="report-kind">报表类型</label>
          <AppSelect
            id="report-kind"
            disabled={busy || !!draft}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm disabled:opacity-60"
            value={kind}
            onChange={(event) => setKind(event.target.value as "daily" | "advertising")}
          >
            <option value="daily">经营报表</option>
            <option value="advertising">推广报表</option>
          </AppSelect>
          <Button
            type="button"
            disabled={disabled || busy}
            className="min-h-11 px-5 shadow-sm"
            onClick={() => fileRef.current?.click()}
          >
            <FileImage size={17} />
            {busy
              ? <><LoaderCircle size={16} className="animate-spin" />正在识别 {progress}%</>
              : <><ScanLine size={17} />上传报表截图开始识别</>}
          </Button>
          <input
            ref={fileRef}
            id="report-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void recognize(file, kind);
            }}
          />
        </div>
        {disabled && <p className="mt-3 text-xs text-muted-foreground">当前账号只有查看权限，无法导入数据。</p>}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
        图片和识别内容仅在当前浏览器处理，不会上传至 MoonClean 服务器。首次使用会从 jsDelivr 下载 OCR 引擎和中文识别模型。识别到推广报表时，可核对总花费、交易额、净交易额和净成交笔数；ROAS、净 ROAS、单笔净成交花费及净交易额占比会在报表页计算。
        </p>
      </SectionCard>

      <Dialog
        open={!!draft || !!feedback}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
            setFeedback(null);
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          {feedback ? (
            <>
              <DialogHeader>
                <DialogTitle>{feedback.title}</DialogTitle>
              </DialogHeader>
              <p role="status" className="text-sm leading-6 text-muted-foreground">{feedback.message}</p>
              <Button className="w-full sm:w-auto sm:self-end" onClick={() => setFeedback(null)}>知道了</Button>
            </>
          ) : draft ? (
            <>
              <DialogHeader>
                <DialogTitle>核对识别结果</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {draft.kind === "daily" ? "经营报表" : "推广报表"} · 请检查字段后再保存，确认前不会写入数据。
                </p>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="report-date">报表日期</label>
                  <Input id="report-date" type="date" className="mt-1" value={draft.date} onChange={(event) => edit("date", event.target.value)} />
                </div>
                {fields.map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground" htmlFor={`report-${key}`}>{label}</label>
                    <Input
                      id={`report-${key}`}
                      inputMode={key === "orders" || key === "buyers" || key === "visitors" || key === "refundOrders" || key === "attributedOrders" ? "numeric" : "decimal"}
                      className={`mt-1 ${requiredKeys.includes(key) && draft[key] === "" ? "border-border" : ""}`}
                      value={draft[key]}
                      onChange={(event) => edit(key, event.target.value)}
                      placeholder="请核对或补填"
                    />
                  </div>
                ))}
              </div>
              {draft.kind === "advertising" && (
                <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3 text-sm text-primary">
                  实际投产比预览：<strong className="text-foreground">{previewRoas === null ? "—" : `${previewRoas.toFixed(2)}x`}</strong>
                  <span className="ml-1 text-xs">（交易额 ÷ 总花费）</span>
                  {draft.netAttributedSales !== "" && Number(draft.spend) > 0 && <span className="ml-3">净实际投产比：<strong className="text-foreground">{(Number(draft.netAttributedSales) / Number(draft.spend)).toFixed(2)}x</strong></span>}
                </div>
              )}
              {error && <p role="alert" className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]">{error}</p>}
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">查看 OCR 原文</summary>
                <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs text-muted-foreground">{draft.rawText}</pre>
              </details>
              <Button className="w-full sm:w-auto sm:self-end" disabled={busy} onClick={() => void confirm()}>
                {busy ? "正在保存…" : "核对无误，保存这一天"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
