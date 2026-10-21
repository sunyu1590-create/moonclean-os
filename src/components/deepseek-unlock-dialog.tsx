"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchDeepSeekKey } from "@/lib/deepseek-key";

export function DeepSeekUnlockDialog({ storeId, open, onOpenChange, onUnlock }: {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: (apiKey: string) => Promise<void> | void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      <DialogHeader><span className="grid size-10 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><KeyRound size={18}/></span><DialogTitle className="pt-1">解锁 DeepSeek</DialogTitle><DialogDescription>输入四位密码以解密云端密钥。累计输错五次后，保存的密钥会被清除。</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <Input autoFocus inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" aria-label="四位解锁密码" placeholder="四位数字密码" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} disabled={busy}/>
        {error && <p role="alert" className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={busy || pin.length !== 4}>{busy ? "正在解锁…" : "解锁并继续"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
