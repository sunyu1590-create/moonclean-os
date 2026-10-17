"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Package, Boxes } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addMoney, formatMoney, skuContribution } from "@/lib/finance";
import { productSchema } from "@/lib/repository";
import type { Product, SKU } from "@/lib/model";
const blankSku = (): SKU => ({
  id: crypto.randomUUID(),
  name: "",
  price: "0",
  cost: { production: "0", packaging: "0", logistics: "0", platform: "0" },
});
const blankProduct = (): Product => ({
  id: crypto.randomUUID(),
  name: "",
  category: "",
  createdAt: new Date().toISOString().slice(0, 10),
  skus: [blankSku()],
});
const fields = [
  ["production", "生产成本"],
  ["packaging", "包装成本"],
  ["logistics", "物流成本"],
  ["platform", "平台费用"],
] as const;
export default function Products() {
  const { data, update, role, saving, mode } = useApp();
  const canEdit = role !== "viewer";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [error, setError] = useState("");
  if (!data) return <p>正在加载数据…</p>;
  function openForm(product?: Product) {
    setDraft(product ? structuredClone(product) : blankProduct());
    setError("");
    setOpen(true);
  }
  async function save() {
    if (!draft) return;
    const result = productSchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "请检查输入");
      return;
    }
    try {
      await update((current) => ({
        ...current,
        products: current.products.some((p) => p.id === draft.id)
          ? current.products.map((p) =>
              p.id === draft.id ? { ...draft, isDemo: false } : p,
            )
          : [...current.products, { ...draft, isDemo: false }],
      }));
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  async function removeProduct() {
    if (!deleting) return;
    try {
      await update((current) => ({
        ...current,
        products: current.products.filter((p) => p.id !== deleting.id),
      }));
      setDeleting(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    }
  }
  function updateSku(id: string, fn: (sku: SKU) => SKU) {
    setDraft((current) =>
      current
        ? {
            ...current,
            skus: current.skus.map((s) => (s.id === id ? fn(s) : s)),
          }
        : current,
    );
  }
  return (
    <>
      <PageHead
        eyebrow="CATALOG / 商品管理"
        title="把商品的每一分利润算清楚"
        description="管理商品规格、售价及单件成本，快速查看贡献利润。"
        action={
          canEdit ? (
            <Button onClick={() => openForm()}>
              <Plus size={17} />
              新增商品
            </Button>
          ) : null
        }
      />
      <div className="mb-5 flex items-center gap-2 text-xs text-[#8fa3b6]">
        <Package size={15} />
        已收录 {data.products.length} 个商品 ·{" "}
        {data.products.reduce((n, p) => n + p.skus.length, 0)} 个 SKU ·
        示例商品标记为模拟数据
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {data.products.map((product) => (
          <SectionCard
            key={product.id}
            title={product.name}
            sub={`${product.category} · ${product.skus.length} 个规格`}
            action={
              canEdit ? (
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`编辑${product.name}`}
                    onClick={() => openForm(product)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`删除${product.name}`}
                    onClick={() => setDeleting(product)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ) : null
            }
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-[#eaf5ff] px-2.5 py-1 text-[11px] text-[#3b91eb]">
                {product.isDemo ? "模拟数据" : "自定义商品"}
              </span>
            </div>
            <div className="space-y-3">
              {product.skus.map((sku) => (
                <div
                  key={sku.id}
                  className="rounded-xl border border-[#eaf0f6] bg-[#fbfdff] p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Boxes size={16} className="text-[#3b91eb]" />
                    <span className="text-sm font-semibold">{sku.name}</span>{sku.code && <span className="text-xs text-[#9aabba]">{sku.code}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[#9aabba]">售价</p>
                      <p className="number mt-1 text-sm font-semibold">
                        {formatMoney(sku.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#9aabba]">成本合计</p>
                      <p className="number mt-1 text-sm font-semibold">
                        {sku.costComplete === false ? "数据不完整" : formatMoney(addMoney(Object.values(sku.cost)))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#9aabba]">单件贡献利润</p>
                      <p
                        className={`number mt-1 text-sm font-bold ${Number(skuContribution(sku)) >= 0 ? "positive" : "negative"}`}
                      >
                        {sku.costComplete === false ? "数据不完整" : formatMoney(skuContribution(sku))}
                      </p>
                    </div>
                  </div>
                  {sku.costHistory && sku.costHistory.length > 0 && <details className="mt-3 border-t border-[#eaf0f6] pt-3 text-xs text-[#70879b]"><summary className="cursor-pointer">查看历史成本版本（{sku.costHistory.length}）</summary><div className="mt-2 space-y-1">{sku.costHistory.map((entry,index) => <p key={`${entry.effectiveFrom}-${index}`}>{entry.effectiveFrom} 起 · 合计 {formatMoney(addMoney(Object.values(entry.cost)))}</p>)}</div></details>}
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {data.products.some((p) => p.id === draft?.id)
                ? "编辑商品"
                : "新增商品"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-5 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>商品名称</Label>
                  <Input
                    className="mt-2"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="例如：月明净 洗衣液"
                  />
                </div>
                <div>
                  <Label>商品类目</Label>
                  <Input
                    className="mt-2"
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                    placeholder="例如：衣物清洁"
                  />
                </div>
              </div>
              <div className="space-y-4">
                {draft.skus.map((sku, index) => (
                  <div
                    key={sku.id}
                    className="rounded-2xl border border-[#e5edf5] bg-[#fafdff] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <strong className="text-sm">规格 {index + 1}</strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={draft.skus.length === 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            skus: draft.skus.filter((s) => s.id !== sku.id),
                          })
                        }
                      >
                        <Trash2 size={14} />
                        移除
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>规格名称</Label>
                        <Input
                          className="mt-1.5"
                          value={sku.name}
                          onChange={(e) =>
                            updateSku(sku.id, (s) => ({
                              ...s,
                              name: e.target.value,
                            }))
                          }
                          placeholder="例如：2kg 家庭装"
                        />
                      </div>
                      <div>
                        <Label>售价（元）</Label>
                        <Input
                          className="mt-1.5"
                          type="number"
                          min="0"
                          step="0.01"
                          value={sku.price}
                          onChange={(e) =>
                            updateSku(sku.id, (s) => ({
                              ...s,
                              price: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div><Label>SKU 编码</Label><Input className="mt-1.5" value={sku.code||""} onChange={e=>updateSku(sku.id,s=>({...s,code:e.target.value}))} placeholder="可选，店铺内唯一"/></div>
                      {fields.map(([key, label]) => (
                        <div key={key}>
                          <Label>{label}（元）</Label>
                          <Input
                            className="mt-1.5"
                            type="number"
                            min="0"
                            step="0.01"
                            value={sku.cost[key]}
                            onChange={(e) =>
                              updateSku(sku.id, (s) => ({
                                ...s,
                                cost: { ...s.cost, [key]: e.target.value },
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl bg-[#eaf7f2] px-4 py-3 text-sm font-semibold text-[#16a085]">
                      单件贡献利润：{formatMoney(skuContribution(sku))}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  setDraft({ ...draft, skus: [...draft.skus, blankSku()] })
                }
              >
                <Plus size={16} />
                添加规格
              </Button>
              {error && <p className="text-sm text-[#e85d65]">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "保存中…" : "保存商品"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === "cloud" ? "确认归档商品？" : "确认删除商品？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "cloud" ? "将归档" : "将删除"}「{deleting?.name}
              」及其全部规格。历史财务数据和成本版本会保留，商品将从当前列表隐藏。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void removeProduct();
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
