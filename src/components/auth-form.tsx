"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Moon, ArrowRight, Mail, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";

type Mode = "login" | "signup" | "forgot" | "reset";
const emailSchema = z.email("请输入有效邮箱地址");
const passwordSchema = z.string().min(8, "密码至少 8 位");
const copy = {
  login: ["欢迎回来", "登录 MoonClean OS，继续掌握店铺经营。", "登录"],
  signup: ["创建账号", "先验证邮箱，再开始管理你的店铺。", "注册账号"],
  forgot: ["找回密码", "我们会向你的邮箱发送重置链接。", "发送重置邮件"],
  reset: ["设置新密码", "为账号设置一个新的安全密码。", "更新密码"],
} as const;
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = !!supabaseConfig();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!configured) {
      setError("请先配置 Supabase 项目地址和 Publishable Key");
      return;
    }
    if (mode !== "reset") {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }
    if (mode !== "forgot") {
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(
          next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
        );
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else
          setMessage("注册申请已提交。请查看邮箱中的验证链接，验证后再登录。");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setMessage("如果邮箱对应有效账号，重置链接会发送到该邮箱。");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("密码已更新。请返回经营总览。");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7fbff] px-5 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-9 flex items-center justify-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#3b91eb] text-white shadow-[0_9px_23px_#3b91eb38]">
            <Moon size={24} fill="white" />
          </span>
          <span className="text-xl font-bold">
            MoonClean <span className="text-[#3b91eb]">OS</span>
          </span>
        </div>
        <div className="glass-card p-7 sm:p-9">
          <p className="mb-2 text-xs font-bold tracking-[.18em] text-[#3b91eb]">
            MOONCLEAN OS
          </p>
          <h1 className="text-[27px] font-bold">{copy[mode][0]}</h1>
          <p className="mt-2 mb-7 text-sm text-[#8396a9]">{copy[mode][1]}</p>
          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <Label htmlFor="displayName">昵称</Label>
                <Input
                  id="displayName"
                  className="mt-2"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  placeholder="你的称呼"
                />
              </div>
            )}
            {mode !== "reset" && (
              <div>
                <Label htmlFor="email">邮箱</Label>
                <div className="relative mt-2">
                  <Mail
                    size={16}
                    className="absolute left-3 top-2.5 text-[#99aabd]"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </div>
            )}
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {mode === "reset" ? "新密码" : "密码"}
                  </Label>
                  {mode === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-[#3b91eb] hover:underline"
                    >
                      忘记密码？
                    </Link>
                  )}
                </div>
                <div className="relative mt-2">
                  <LockKeyhole
                    size={16}
                    className="absolute left-3 top-2.5 text-[#99aabd]"
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 8 位"
                  />
                </div>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#fff0f1] p-3 text-sm text-[#cf5960]"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-xl bg-[#eaf7f2] p-3 text-sm text-[#15836f]"
              >
                {message}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !configured}
            >
              {busy ? "请稍候…" : copy[mode][2]}
              <ArrowRight size={16} />
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-[#8296a9]">
            {mode === "login" ? (
              <>
                还没有账号？{" "}
                <Link href="/signup" className="font-semibold text-[#3b91eb]">
                  立即注册
                </Link>
              </>
            ) : mode === "reset" ? (
              <Link href="/dashboard" className="font-semibold text-[#3b91eb]">
                返回经营总览
              </Link>
            ) : (
              <Link href="/login" className="font-semibold text-[#3b91eb]">
                返回登录
              </Link>
            )}
          </div>
        </div>
        {!configured && (
          <p className="mt-5 text-center text-xs text-[#e85d65]">
            当前环境尚未配置 Supabase，参照 .env.example
            配置后即可使用云端登录。
          </p>
        )}
      </div>
    </div>
  );
}
