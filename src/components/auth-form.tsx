"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Moon, ArrowRight, Mail, LockKeyhole, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import { useLanguage } from "@/components/language-provider";

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
  const { language, toggleLanguage, t } = useLanguage();
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
    <div className="min-h-screen bg-[var(--mc-tint-blue)] p-4 sm:p-8 lg:p-10">
      <button type="button" onClick={toggleLanguage} aria-label={language === "zh-CN" ? "Switch to English" : "切换为中文"} className="fixed right-4 top-4 z-20 inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur"><Languages size={15}/>{language === "zh-CN" ? "EN" : "中文"}</button>
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-[1240px] overflow-hidden rounded-[30px] border border-border bg-card shadow-[0_24px_70px_rgba(29,43,62,.08)] lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden overflow-hidden bg-[var(--mc-color-brand-strong)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-44 -top-44 size-[520px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-24 -top-20 size-[360px] rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[15px] bg-card text-foreground"><Moon size={23} fill="#202936"/></span><span className="text-xl font-bold tracking-[-.04em]">MoonClean <span className="text-primary">OS</span></span></div>
          <div className="relative max-w-lg pb-8"><p className="mb-5 text-xs font-semibold tracking-[.24em] text-primary">{language === "en-US" ? "MOONCLEAN · SMART BUSINESS WORKSPACE" : "月明净 · 智能经营工作台"}</p><h2 className="text-[48px] font-semibold leading-[1.17] tracking-[-.055em]">{language === "en-US" ? <>A clearer view<br/>of every business.</> : <>让每一笔生意，<br/>都看得更清楚。</>}</h2><p className="mt-6 max-w-md text-[15px] leading-8 text-muted-foreground">{language === "en-US" ? "Turn daily complexity into clear, reliable decisions, from sales trends to profit." : "从销售趋势到利润结构，把日常经营里的复杂问题，整理成清晰、可靠的判断。"}</p></div>
          <div className="relative flex flex-wrap gap-2 text-xs text-primary"><span className="rounded-full border border-white/15 px-4 py-2">{t("经营总览")}</span><span className="rounded-full border border-white/15 px-4 py-2">{language === "en-US" ? "Profit analysis" : "利润分析"}</span><span className="rounded-full border border-white/15 px-4 py-2">{language === "en-US" ? "Cloud sync" : "云端同步"}</span></div>
        </aside>
        <div className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-[430px]">
        <div className="mb-9 flex items-center justify-center gap-3 lg:hidden">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-white">
            <Moon size={24} fill="white" />
          </span>
          <span className="text-xl font-bold">
            MoonClean <span className="text-primary">OS</span>
          </span>
        </div>
        <div className="p-2 sm:p-4">
          <p className="mb-3 text-xs font-bold tracking-[.18em] text-primary">
            MOONCLEAN OS
          </p>
          <h1 className="text-[32px] font-bold tracking-[-.04em] text-foreground">{t(copy[mode][0])}</h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">{t(copy[mode][1])}</p>
          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <Label htmlFor="displayName">{t("昵称")}</Label>
                <Input
                  id="displayName"
                  className="mt-2"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  placeholder={t("你的称呼")}
                />
              </div>
            )}
            {mode !== "reset" && (
              <div>
                <Label htmlFor="email">{t("邮箱")}</Label>
                <div className="relative mt-2">
                  <Mail
                    size={16}
                    className="absolute left-3 top-2.5 text-muted-foreground"
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
                    {t(mode === "reset" ? "新密码" : "密码")}
                  </Label>
                  {mode === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      {t("忘记密码？")}
                    </Link>
                  )}
                </div>
                <div className="relative mt-2">
                  <LockKeyhole
                    size={16}
                    className="absolute left-3 top-2.5 text-muted-foreground"
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
                    placeholder={t("至少 8 位")}
                  />
                </div>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-xl bg-[var(--mc-tint-green)] p-3 text-sm text-[var(--mc-color-success)]"
              >
                {message}
              </p>
            )}
            <Button
              type="submit"
              className="mt-2 h-11 w-full"
              disabled={busy || !configured}
            >
              {busy ? t("请稍候…") : t(copy[mode][2])}
              <ArrowRight size={16} />
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                {t("还没有账号？")} {" "}
                <Link href="/signup" className="font-semibold text-primary">
                  {t("立即注册")}
                </Link>
              </>
            ) : mode === "reset" ? (
              <Link href="/dashboard" className="font-semibold text-primary">
                {t("返回经营总览")}
              </Link>
            ) : (
              <Link href="/login" className="font-semibold text-primary">
                {t("返回登录")}
              </Link>
            )}
          </div>
        </div>
        {!configured && (
          <p className="mt-5 text-center text-xs text-[var(--mc-color-danger)]">
            当前环境尚未配置 Supabase，参照 .env.example
            配置后即可使用云端登录。
          </p>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
