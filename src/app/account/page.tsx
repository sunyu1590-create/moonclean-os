"use client";
import { useEffect, useState } from "react";
import { UserRound, LockKeyhole } from "lucide-react";
import { PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/components/app-provider";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { notifyFeedback } from "@/lib/feedback";
export default function AccountPage() {
  const { mode } = useApp();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (mode !== "cloud") return;
    let active = true;
    fetch("/api/account")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (active) {
          setEmail(body.email || "");
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
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, avatarUrl: avatar }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setMessage("账号资料已保存");
      notifyFeedback({ kind: "success", title: "账号资料已保存" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      notifyFeedback({ kind: "error", title: "账号资料保存失败", description: e instanceof Error ? e.message : "请重试。" });
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    setBusy(true);
    setError("");
    try {
      const { error } =
        await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
      if (error) throw error;
      setMessage("密码重置邮件已发送，请检查邮箱。");
      notifyFeedback({ kind: "success", title: "重置邮件已发送", description: "请前往邮箱打开密码重置链接。" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
      notifyFeedback({ kind: "error", title: "发送失败", description: e instanceof Error ? e.message : "请检查邮箱后重试。" });
    } finally {
      setBusy(false);
    }
  }
  if (mode === "local") return <p>本地演示模式没有云端账号。</p>;
  return (
    <>
      <PageHead
        eyebrow="ACCOUNT / 当前账号"
        title="管理你的账号"
        description="更新个人资料与登录密码。"
      />
      <div className="grid max-w-3xl gap-5">
        <SectionCard
          title="个人资料"
          sub={email}
          action={<UserRound size={19} className="text-[#3b91eb]" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>昵称</Label>
              <Input
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>头像 URL</Label>
              <Input
                className="mt-2"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <Button className="mt-5" disabled={busy} onClick={() => void save()}>
            保存资料
          </Button>
        </SectionCard>
        <SectionCard
          title="账号安全"
          sub="通过已验证邮箱重置密码"
          action={<LockKeyhole size={19} className="text-[#3b91eb]" />}
        >
          <Button
            variant="outline"
            disabled={busy || !email}
            onClick={() => void resetPassword()}
          >
            发送密码重置邮件
          </Button>
        </SectionCard>
        {error && (
          <p role="alert" className="text-sm text-[#e85d65]">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-[#16a085]">
            {message}
          </p>
        )}
      </div>
    </>
  );
}
