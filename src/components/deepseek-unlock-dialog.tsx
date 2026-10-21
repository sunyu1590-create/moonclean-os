"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEEPSEEK_UNLOCK_DURATIONS, fetchDeepSeekKey, getDeepSeekUnlockDuration } from "@/lib/deepseek-key";

export function DeepSeekUnlockDialog({ storeId, open, onOpenChange, onUnlock }: {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: (apiKey: string) => Promise<void> | void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const duration = DEEPSEEK_UNLOCK_DURATIONS.find((item) => item.value === getDeepSeekUnlockDuration(storeId));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin) || busy) return;
    setBusy(true); setError("");
    let apiKey = "";
    try {
      ({ apiKey } = await fetchDeepSeekKey(storeId, pin));
    } catch (cause) {
      setPin("");
      setError(cause instanceof Error ? cause.message : "解锁失败，请重试。");
      setBusy(false);
      return;
    }
    setBusy(false);
    setPin("");
    onOpenChange(false);
    await onUnlock(apiKey);
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!next) { setPin(""); setError(""); } onOpenChange(next); }}>
    <DialogContent className="rounded-[24px] p-5 sm:max-w-sm">
      <DialogHeader><span className="grid size-10 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><KeyRound size={18}/></span><DialogTitle className="pt-1">解锁 DeepSeek</DialogTitle><DialogDescription>输入四位密码以解密云端密钥。解锁后 {duration?.value === "per-call" ? "本次调用有效" : `${duration?.label || "3 天"}再次验证`}。累计输错五次后，保存的密钥会被清除。</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <PinPad value={pin} onChange={setPin} disabled={busy} label="输入四位解锁密码"/>
        {error && <p role="alert" className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={busy || pin.length !== 4}>{busy ? "正在解锁…" : "解锁并继续"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
