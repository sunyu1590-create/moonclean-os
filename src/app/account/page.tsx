"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, KeyRound, LockKeyhole, Mail, Smartphone, UserRound } from "lucide-react";
import { PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/components/app-provider";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { getBrowserDeviceId } from "@/lib/browser-device-id";
import { notifyFeedback } from "@/lib/feedback";

const AVATAR_BUCKET = "moonclean-avatars";

function avatarObjectPath(url: string, userId: string) {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    return path.startsWith(`${userId}/`) ? path : null;
  } catch {
    return null;
  }
}

export default function AccountPage() {
  const { mode } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<Array<{session_id:string;device_id:string|null;device_label:string;created_at:string;last_seen_at:string;revoked_at:string|null;current:boolean;session_count:number}>>([]);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingDevice, setRevokingDevice] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{deviceId:string|null;label:string}|null>(null);

  async function loadSessions() {
    const deviceId = getBrowserDeviceId();
    const response = await fetch("/api/account/sessions", { cache: "no-store", headers: deviceId ? { "x-moonclean-device-id": deviceId } : undefined });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "设备列表加载失败");
    setSessions(body.sessions || []);
  }

  async function revokeDevice() {
    if (!removeTarget) return;
    const target = removeTarget;
    const busyKey = target.deviceId || "legacy-unidentified";
    setRevokingDevice(busyKey);
    try {
      const response = await fetch("/api/account/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(target.deviceId ? { deviceId: target.deviceId } : { legacy: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "移除设备失败");
      setRemoveTarget(null);
      await loadSessions();
      notifyFeedback({ kind: "success", title: target.deviceId ? "已移除登录设备" : "已清理旧版会话", description: "相关设备的后续应用请求将被拒绝。" });
    } catch (cause) {
      setSessionsError(cause instanceof Error ? cause.message : "移除设备失败");
    } finally { setRevokingDevice(""); }
  }

  useEffect(() => {
    if (mode !== "cloud") return;
    let active = true;
    fetch("/api/account")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (active) {
          setUserId(body.userId || "");
          setEmail(body.email || "");
          setEmailConfirmed(Boolean(body.emailConfirmed));
          setName(body.profile.display_name || "");
          setAvatar(body.profile.avatar_url || "");
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "加载账号失败");
      });
    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "cloud") return;
    let active = true;
    const deviceId = getBrowserDeviceId();
    fetch("/api/account/sessions", { cache: "no-store", headers: deviceId ? { "x-moonclean-device-id": deviceId } : undefined }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "设备列表加载失败");
      if (active) setSessions(body.sessions || []);
    }).catch((cause) => {
      if (active) setSessionsError(cause instanceof Error ? cause.message : "设备列表加载失败");
    });
    return () => { active = false; };
  }, [mode]);

  async function saveProfile(nextAvatar = avatar) {
    const r = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name, avatarUrl: nextAvatar }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveProfile();
      setMessage("个人资料已保存");
      notifyFeedback({ kind: "success", title: "个人资料已保存" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      notifyFeedback({ kind: "error", title: "资料保存失败", description: e instanceof Error ? e.message : "请重试。" });
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (!userId) return setError("账号信息尚未加载完成，请稍后重试。");
    if (!("image/jpeg" === file.type || "image/png" === file.type || "image/webp" === file.type)) {
      return setError("头像仅支持 JPG、PNG 或 WebP 格式。");
    }
    if (file.size > 2 * 1024 * 1024) return setError("头像文件不能超过 2 MB。");

    setUploading(true);
    const supabase = createBrowserSupabaseClient();
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      await saveProfile(data.publicUrl);
      const oldPath = avatarObjectPath(avatar, userId);
      if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      setAvatar(data.publicUrl);
      setMessage("头像已上传并保存");
      notifyFeedback({ kind: "success", title: "头像已更新" });
    } catch (cause) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      setError(cause instanceof Error ? cause.message : "头像上传失败，请重试。");
      notifyFeedback({ kind: "error", title: "头像上传失败", description: cause instanceof Error ? cause.message : "请重试。" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function changePassword() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (password.length < 8) throw new Error("新密码至少需要 8 位。");
      if (password !== confirmPassword) throw new Error("两次输入的新密码不一致。");
      const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmPassword("");
      setMessage("登录密码已更新。请妥善保管新密码。");
      notifyFeedback({ kind: "success", title: "登录密码已更新" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "密码更新失败");
      notifyFeedback({ kind: "error", title: "密码更新失败", description: cause instanceof Error ? cause.message : "请重试。" });
    } finally {
      setBusy(false);
    }
  }

  async function requestEmailChange() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const requested = nextEmail.trim();
      if (!requested || requested.toLowerCase() === email.toLowerCase()) throw new Error("请输入与当前邮箱不同的新邮箱。");
      const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({ email: requested });
      if (updateError) throw updateError;
      setNextEmail("");
      setMessage("邮箱更换验证邮件已发送，请按邮件提示完成确认。");
      notifyFeedback({ kind: "success", title: "邮箱更换申请已提交", description: "请检查新邮箱中的验证邮件。" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "邮箱更换申请失败");
      notifyFeedback({ kind: "error", title: "邮箱更换申请失败", description: cause instanceof Error ? cause.message : "请检查邮箱后重试。" });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: resetError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      setMessage("密码重置邮件已发送，请检查邮箱。");
      notifyFeedback({ kind: "success", title: "重置邮件已发送", description: "请前往邮箱打开密码重置链接。" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发送失败");
      notifyFeedback({ kind: "error", title: "发送失败", description: cause instanceof Error ? cause.message : "请检查邮箱后重试。" });
    } finally {
      setBusy(false);
    }
  }

  if (mode === "local") return <p>本地演示模式没有云端账号。</p>;
  return (
    <>
      <PageHead eyebrow="ACCOUNT / 当前账号" title="管理你的账号" description="个人资料、登录邮箱与账号安全设置。" />
      <div className="grid max-w-3xl gap-5">
        <SectionCard title="个人资料" sub="头像与昵称会展示给你所在店铺的团队成员" action={<UserRound size={19} className="text-primary" />}>
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-muted/25 p-4">
            <div className="relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-[var(--mc-tint-blue)] text-primary">
              {avatar ? <Image src={avatar} alt="当前头像" fill unoptimized sizes="72px" className="object-cover" /> : <UserRound size={28} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">账号头像</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">JPG、PNG 或 WebP，最大 2 MB。头像仅用于识别团队成员。</p>
            </div>
            <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
            <Button type="button" variant="outline" disabled={uploading || !userId} onClick={() => fileInput.current?.click()}>
              <Camera size={15} />{uploading ? "正在上传…" : avatar ? "更换头像" : "上传头像"}
            </Button>
          </div>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="account-name">昵称</Label>
              <Input id="account-name" className="mt-2" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="团队成员看到的称呼" />
            </div>
            <div>
              <Label htmlFor="account-email">登录邮箱</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input id="account-email" value={email} readOnly className="min-w-0 flex-1 bg-muted/30" />
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs ${emailConfirmed ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-[var(--mc-tint-amber)] text-amber-700 dark:text-amber-300"}`}>
                  <BadgeCheck size={14} />{emailConfirmed ? "已验证" : "待验证"}
                </span>
              </div>
            </div>
          </div>
          <Button className="mt-5" disabled={busy || uploading} onClick={() => void save()}>保存资料</Button>
        </SectionCard>

        <SectionCard title="已登录设备" sub="查看曾登录此账号的设备，并移除不再使用的会话" action={<Smartphone size={19} className="text-primary" />}>
          {sessionsError && <p role="alert" className="mb-3 text-sm text-[var(--mc-color-danger)]">{sessionsError}</p>}
          {sessions.length ? <div className="space-y-2">{sessions.map((session) => <div key={session.device_id || "legacy-unidentified"} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Smartphone size={17}/></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{session.device_id ? session.device_label : "未识别的旧版会话"}{session.current && <span className="ml-2 rounded-full bg-[var(--mc-tint-green)] px-2 py-0.5 text-[10px] text-[var(--mc-color-success)]">当前设备</span>}</p><p className="mt-1 text-[11px] text-muted-foreground">{session.device_id ? "最近活动：" : `历史记录 ${session.session_count} 条 · 最近活动：`}{new Date(session.last_seen_at).toLocaleString("zh-CN")}{session.device_id && session.session_count > 1 && <span> · {session.session_count} 次登录</span>}</p></div>
            {!session.current && !session.revoked_at && <Button size="sm" variant="outline" disabled={revokingDevice===(session.device_id || "legacy-unidentified")} onClick={()=>setRemoveTarget({deviceId:session.device_id,label:session.device_label})}>{session.device_id ? "移除此设备" : "清理旧会话"}</Button>}
          </div>)}</div> : <p className="text-sm text-muted-foreground">加载设备列表中…</p>}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">移除后，该设备的应用接口将拒绝后续请求；设备可能需要刷新页面才能显示已退出。</p>
        </SectionCard>

        <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{removeTarget?.deviceId ? "移除此登录设备？" : "清理未识别的旧会话？"}</AlertDialogTitle>
              <AlertDialogDescription>
                {removeTarget?.deviceId ? `“${removeTarget.label}”将无法继续访问账号数据。` : "这些登录记录来自旧版设备列表，无法可靠判断各自对应哪台设备。清理会让所有未识别的旧会话重新登录；当前设备不会退出。"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(revokingDevice)}>取消</AlertDialogCancel>
              <AlertDialogAction disabled={Boolean(revokingDevice)} onClick={(event) => { event.preventDefault(); void revokeDevice(); }}>
                {revokingDevice ? "处理中…" : removeTarget?.deviceId ? "确认移除" : "清理旧会话"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SectionCard title="登录与安全" sub="更换邮箱、更新密码或通过邮箱重置" action={<LockKeyhole size={19} className="text-primary" />}>
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium"><Mail size={16} className="text-primary" />更换登录邮箱</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="email" autoComplete="email" value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} placeholder="输入新的登录邮箱" />
                <Button variant="outline" disabled={busy || !nextEmail.trim()} onClick={() => void requestEmailChange()}>发送验证邮件</Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">邮箱更换需要完成邮件验证；验证完成前仍使用当前邮箱登录。</p>
            </div>
            <div className="border-t border-border pt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><KeyRound size={16} className="text-primary" />直接更新密码</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密码（至少 8 位）" />
                <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={busy || !password || !confirmPassword} onClick={() => void changePassword()}>更新密码</Button>
                <Button variant="outline" disabled={busy || !email} onClick={() => void resetPassword()}>发送密码重置邮件</Button>
              </div>
            </div>
          </div>
        </SectionCard>

        {error && <p role="alert" className="text-sm text-[var(--mc-color-danger)]">{error}</p>}
        {message && <p role="status" className="text-sm text-[var(--mc-color-success)]">{message}</p>}
      </div>
    </>
  );
}
