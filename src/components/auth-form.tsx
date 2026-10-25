"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowRight, Mail, LockKeyhole, Eye, EyeOff, ShieldCheck, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearBrowserSessionPolicy, createBrowserSupabaseClient, isBrowserSessionPolicyExpired, recreateBrowserSupabaseClient, setBrowserSessionPolicy, setBrowserSessionPolicyUntil } from "@/lib/supabase/browser";
import { getBrowserDeviceId } from "@/lib/browser-device-id";
import { supabaseConfig } from "@/lib/supabase/config";
import { useLanguage } from "@/components/language-provider";

type Mode = "login" | "signup" | "forgot" | "reset";
const emailSchema = z.email("请输入有效邮箱地址");
const passwordSchema = z.string().min(8, "密码至少 8 位");
const REMEMBERED_EMAIL_KEY = "moonclean-remembered-email-v1";
const copy = {
  login: ["欢迎回来", "登录 MoonClean OS，继续掌握店铺经营。", "登录"],
  signup: ["创建账号", "先验证邮箱，再开始管理你的店铺。", "注册账号"],
  forgot: ["找回密码", "我们会向你的邮箱发送重置链接。", "发送重置邮件"],
  reset: ["设置新密码", "为账号设置一个新的安全密码。", "更新密码"],
} as const;
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(true);
  const [rememberSession, setRememberSession] = useState(false);
  const configured = !!supabaseConfig();
  const [checkingSession, setCheckingSession] = useState(mode === "login" && configured);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (savedEmail) setEmail(savedEmail);
      } catch { /* Browser account remembrance is optional. */ }
      const authError = new URLSearchParams(window.location.search).get("error");
      if (authError === "session-expired") setMessage(t("保持登录期限已到，请重新登录。"));
      else if (authError === "session-revoked") setMessage(t("此设备的登录已撤销，请重新登录。"));
      else if (authError === "session-check") setMessage(t("暂时无法验证登录状态，请稍后重试。"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [t]);
  useEffect(() => {
    if (mode !== "login" || !configured) return;
    let active = true;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        if (isBrowserSessionPolicyExpired()) {
          await supabase.auth.signOut({ scope: "local" });
          clearBrowserSessionPolicy();
          return;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (data.user) {
          const next = new URLSearchParams(window.location.search).get("next");
          router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
          router.refresh();
          return;
        }
      } catch {
        // An expired or unavailable session should leave the sign-in form usable.
      } finally {
        if (active) setCheckingSession(false);
      }
    })();
    return () => { active = false; };
  }, [configured, mode, router]);
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "day" ? "night" : "day";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === "night" ? "dark" : "light";
    try { localStorage.setItem("moonclean-theme-v1", next); } catch { /* Keep the selected theme for this session. */ }
    window.dispatchEvent(new CustomEvent("moonclean-theme-change", { detail: next }));
  }
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
      if (mode === "login") {
        setBrowserSessionPolicy(rememberSession);
        const browserDeviceId = getBrowserDeviceId();
        const policyResponse = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", ...(browserDeviceId ? { "x-moonclean-device-id": browserDeviceId } : {}) },
          body: JSON.stringify({ email, password, rememberFor30Days: rememberSession }),
        });
        const policyBody = await policyResponse.json().catch(() => ({}));
        if (!policyResponse.ok) {
          if (policyResponse.status === 401 && policyBody.code === "email_not_confirmed") throw new Error(t("请先验证邮箱，再登录。"));
          if (policyResponse.status === 401) throw new Error(t("邮箱或密码不正确。"));
          throw new Error(t("无法保存登录时长设置，请重试。"));
        }
        setBrowserSessionPolicyUntil(policyBody.rememberUntil || null);
        await recreateBrowserSupabaseClient();
        try {
          if (rememberAccount) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
          else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        } catch { /* The browser password manager can still retain the account. */ }
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(
          next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
        );
        router.refresh();
      } else {
        const supabase = createBrowserSupabaseClient();
        if (mode === "signup") {
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
      }
    } catch (cause) {
      if (mode === "login") {
        try { await createBrowserSupabaseClient().auth.signOut({ scope: "local" }); } catch { /* Remove local credentials even if the network is unavailable. */ }
        clearBrowserSessionPolicy();
      }
      setError(cause instanceof Error ? cause.message : "网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page min-h-[100svh] overflow-x-hidden overflow-y-auto px-3 py-3 text-white sm:px-5 sm:py-5 lg:px-7 lg:py-7">
      <div className="auth-frame relative mx-auto grid min-h-[calc(100svh-24px)] max-w-[1440px] overflow-hidden rounded-[28px] border border-white/[.08] lg:min-h-[calc(100svh-56px)] lg:grid-cols-[1.08fr_.92fr]">
        <aside className="auth-brand-panel relative flex min-h-[300px] flex-col justify-between overflow-hidden px-6 py-7 sm:min-h-[340px] sm:px-10 sm:py-9 lg:min-h-0 lg:px-14 lg:py-12 xl:px-[72px] xl:py-[58px]">
          <div className="auth-grid absolute inset-0" aria-hidden="true" />
          <div className="auth-orbit auth-orbit-one absolute" aria-hidden="true" />
          <div className="auth-orbit auth-orbit-two absolute" aria-hidden="true" />
          <div className="auth-glow auth-glow-a absolute" aria-hidden="true" />
          <div className="auth-glow auth-glow-b absolute" aria-hidden="true" />
          <div className="auth-brand-lockup relative z-10 flex items-center gap-3.5">
            <span className="grid size-[52px] shrink-0 place-items-center rounded-[17px] bg-white p-1.5 shadow-[0_8px_28px_rgba(0,0,0,.16)] sm:size-[58px]">
              <Image src="/yue-ming-jing-logo.png" alt="月明净品牌标志" width={128} height={128} priority className="size-full object-contain" />
            </span>
            <span className="text-[17px] font-semibold tracking-[-.035em] text-white sm:text-[19px]">MoonClean <span className="font-medium text-[#7db7ff]">OS</span></span>
          </div>

          <div className="auth-brand-copy relative z-10 max-w-[620px] py-9 lg:py-0">
            <p className="mb-5 flex items-center gap-2.5 text-[10px] font-semibold tracking-[.24em] text-[#8fbdf7] sm:mb-7 sm:text-[11px]">
              <span className="h-px w-7 bg-[#5295ec]/80" />{language === "en-US" ? "MOONCLEAN · SMART BUSINESS WORKSPACE" : "月明净 · 智能经营工作台"}
            </p>
            <h1 className="max-w-[620px] text-[clamp(35px,5vw,64px)] font-medium leading-[1.18] tracking-[-.055em] text-[#f5f8ff]">
              {language === "en-US" ? <>A clearer view<br className="hidden sm:block" /> of every business.</> : <>让每一笔生意，<br />都看得更清楚。</>}
            </h1>
            <p className="mt-5 max-w-[430px] text-[14px] leading-7 text-[#a9bad2] sm:mt-7 sm:text-[15px] sm:leading-8">
              {language === "en-US" ? "From operating data to profit analysis, make every decision with evidence." : <>从经营数据到利润分析，<br className="hidden sm:block" />让每一次决策都有据可依。</>}
            </p>
          </div>

          <div className="auth-brand-footer relative z-10 flex flex-wrap items-center gap-2.5 text-[11px] text-[#b8c8df] sm:gap-3">
            <span className="auth-feature-chip">{t("经营总览")}</span>
            <span className="auth-feature-chip">{language === "en-US" ? "Profit analysis" : "利润分析"}</span>
            <span className="auth-feature-chip">{language === "en-US" ? "Cloud sync" : "云端同步"}</span>
            <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-[#93a9c5] sm:inline-flex"><ShieldCheck size={13} />{language === "en-US" ? "Private, secure workspace" : "安全可信的经营空间"}</span>
          </div>
        </aside>

        <section className="auth-form-panel relative flex items-center justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-12 xl:px-16">
          <div className="auth-form-content w-full max-w-[408px]">
            <div className="auth-preferences mb-7 flex items-center justify-end gap-2" aria-label={language === "en-US" ? "Display preferences" : "显示偏好设置"}>
              <button type="button" onClick={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")} className="auth-preference-button" aria-label={language === "en-US" ? "Switch language to Chinese" : "切换界面语言为英文"} title={language === "en-US" ? "Switch language to Chinese" : "切换界面语言为英文"}>
                <span className="text-[11px] font-semibold tracking-wide">{language === "zh-CN" ? "EN" : "中文"}</span>
              </button>
              <button type="button" onClick={toggleTheme} className="auth-preference-button" aria-label={language === "en-US" ? "Toggle day and night mode" : "切换日夜模式"} title={language === "en-US" ? "Toggle day and night mode" : "切换日夜模式"}>
                <SunMoon size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="mb-8 sm:mb-10" aria-busy={checkingSession}>
              <p className="mb-3 text-[10px] font-semibold tracking-[.2em] text-[#78aef2] sm:text-[11px]">MOONCLEAN OS</p>
              <h2 className="text-[30px] font-semibold leading-tight tracking-[-.045em] text-[#f5f8ff] sm:text-[34px]">{t(copy[mode][0])}</h2>
              <p className="mt-2.5 text-[13px] leading-6 text-[#a5b7d2] sm:text-sm">{t(copy[mode][1])}</p>
              {checkingSession && <p role="status" className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#5b98e8]/25 bg-[#2878db]/10 px-3 py-1.5 text-xs text-[#bcd8ff]"><span className="size-1.5 animate-pulse rounded-full bg-[#69aaff]" />{t("正在验证登录状态…")}</p>}
            </div>

            <form onSubmit={submit} className="auth-form-fields space-y-[18px]" aria-busy={checkingSession || busy}>
              {mode === "signup" && (
                <div className="auth-field">
                  <Label htmlFor="displayName" className="text-[12px] font-medium text-[#d4deed]">{t("昵称")}</Label>
                  <Input id="displayName" className="auth-input mt-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} placeholder={t("你的称呼")} />
                </div>
              )}
              {mode !== "reset" && (
                <div className="auth-field">
                  <Label htmlFor="email" className="text-[12px] font-medium text-[#d4deed]">{t("邮箱")}</Label>
                  <div className="auth-input-wrap relative mt-2">
                    <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8399b6]" />
                    <Input id="email" type="email" name="username" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} className="auth-input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                  </div>
                </div>
              )}
              {mode !== "forgot" && (
                <div className="auth-field">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password" className="text-[12px] font-medium text-[#d4deed]">{t(mode === "reset" ? "新密码" : "密码")}</Label>
                    {mode === "login" && <Link href="/forgot-password" className="rounded-md text-xs text-[#8bbaff] transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f97f4]">{t("忘记密码？")}</Link>}
                  </div>
                  <div className="auth-input-wrap relative mt-2">
                    <LockKeyhole size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8399b6]" />
                    <Input id="password" type={showPassword ? "text" : "password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="auth-input pr-12 pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("至少 8 位")} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (language === "en-US" ? "Hide password" : "隐藏密码") : (language === "en-US" ? "Show password" : "显示密码")} aria-pressed={showPassword} className="auth-password-toggle absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#8fa3c0] transition-colors hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f97f4]">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
              {mode === "login" && <div className="grid gap-3 rounded-xl border border-white/[.07] bg-white/[.025] px-3.5 py-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-[#c4d2e5]">
                  <input type="checkbox" checked={rememberAccount} onChange={(event) => { const checked = event.target.checked; setRememberAccount(checked); if (!checked) try { localStorage.removeItem(REMEMBERED_EMAIL_KEY); } catch { /* Account memory is optional. */ } }} className="mt-1 size-3.5 accent-[#398bff]" />
                  <span><span className="block font-medium text-[#e3ebf6]">{t("记住账号")}</span><span className="text-[11px] text-[#91a5c1]">{t("仅保存在当前浏览器")}</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-[#c4d2e5]">
                  <input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} className="mt-1 size-3.5 accent-[#398bff]" />
                  <span><span className="block font-medium text-[#e3ebf6]">{t("30 天内保持登录")}</span><span className="text-[11px] text-[#91a5c1]">{t("仅在可信的个人设备开启")}</span></span>
                </label>
              </div>}
              {error && <p role="alert" className="auth-feedback auth-feedback-error rounded-xl px-3.5 py-3 text-[13px] leading-5">{error}</p>}
              {message && <p role="status" className="auth-feedback auth-feedback-success rounded-xl px-3.5 py-3 text-[13px] leading-5">{message}</p>}
              <Button type="submit" loading={busy} className="auth-submit mt-2 h-[50px] w-full justify-between rounded-xl px-4 text-[14px] font-semibold" disabled={busy || checkingSession || !configured}>
                <span>{busy ? t("请稍候…") : t(copy[mode][2])}</span>
                {!busy && !checkingSession && <ArrowRight size={17} aria-hidden="true" />}
              </Button>
            </form>

            <div className="mt-7 text-center text-[13px] text-[#91a5c1]">
              {mode === "login" ? <>{t("还没有账号？")} <Link href="/signup" className="auth-inline-link ml-1 font-semibold">{t("立即注册")}</Link></> : mode === "reset" ? <Link href="/dashboard" className="auth-inline-link font-semibold">{t("返回经营总览")}</Link> : <Link href="/login" className="auth-inline-link font-semibold">{t("返回登录")}</Link>}
            </div>
            {!configured && <p className="mt-5 text-center text-xs leading-5 text-[#e69b9b]">当前环境尚未配置 Supabase，参照 .env.example 配置后即可使用云端登录。</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
