"use client";
import { AppSelect } from "@/components/ui/app-select";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Wallet,
  Database,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  LogOut,
  CircleUserRound,
  RefreshCw,
  LoaderCircle,
  Cloud,
  HardDrive,
  Plug,
  ListChecks,
  Menu,
  ShoppingCart,
  Boxes,
  ClipboardCheck,
  ChartNoAxesCombined,
  Calculator,
  ReceiptText,
  FileText,
  SlidersHorizontal,
  Check,
  Sparkles,
  Moon,
  Sun,
  NotebookPen,
  BrainCircuit,
  FlaskConical,
  SearchCheck,
  Headset,
  MessageCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { clearBrowserSessionPolicy, createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "./app-provider";
import { getMobileNavigationSlot } from "@/lib/mobile-navigation";
import { useLanguage } from "@/components/language-provider";

function LoadingElapsed() {
  const { t } = useLanguage();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds((Date.now() - startedAt) / 1000), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <p className="mt-3 text-center text-[11px] tabular-nums text-muted-foreground">{t("正在加载店铺数据")} · {seconds.toFixed(1)}s</p>;
}
import { DataTransitionOverlay } from "@/components/data-transition-overlay";
import { PerformanceDebugCapsule } from "@/components/performance-debug-capsule";
import { FeedbackViewport } from "@/components/feedback-viewport";
import { Skeleton } from "@/components/ui/skeleton";
import { useMotionPreferences } from "@/components/motion-preferences";
import { isRestorableAppRoute, LAST_VISITED_ROUTE_COOKIE } from "@/lib/last-visited-route";
const nav = [
  { href: "/dashboard", label: "经营总览", icon: LayoutDashboard },
  { href: "/advertising", label: "推广分析", icon: Megaphone },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/orders", label: "订单中心", icon: ShoppingCart },
  { href: "/inventory", label: "库存管理", icon: Boxes },
  { href: "/tasks", label: "运营待办", icon: ClipboardCheck },
  { href: "/notes", label: "笔记中心", icon: NotebookPen },
  { href: "/copilot", label: "AI 运营助手", icon: BrainCircuit },
  { href: "/ai-chat", label: "AI 聊天", icon: MessageCircle },
  { href: "/ai-settings", label: "AI 设置", icon: Sparkles },
  { href: "/experiments", label: "运营实验室", icon: FlaskConical },
  { href: "/competitors", label: "竞品情报", icon: SearchCheck },
  { href: "/service", label: "客服与售后", icon: Headset },
  { href: "/product-insights", label: "商品诊断", icon: ChartNoAxesCombined },
  { href: "/pricing", label: "定价模拟", icon: Calculator },
  { href: "/after-sales", label: "售后分析", icon: ReceiptText },
  { href: "/reports", label: "经营报告", icon: FileText },
  { href: "/finance", label: "财务利润", icon: Wallet },
  { href: "/data", label: "数据中心", icon: Database },
  { href: "/settings", label: "系统设置", icon: Settings },
  { href: "/motion", label: "动效设置", icon: Sparkles },
  { href: "/integrations", label: "平台连接", icon: Plug },
  { href: "/sync-center", label: "同步任务", icon: ListChecks },
];
const defaultMobilePrimary = ["/dashboard", "/products", "/data", "/finance"];
const mobileNavStorageKey = "moonclean-mobile-navigation-v1";
const themeStorageKey = "moonclean-theme-v1";
const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password"];
const roleLabels = {
  owner: "所有者",
  admin: "管理员",
  editor: "编辑者",
  viewer: "查看者",
};
function StoreOnboarding() {
  const { language, t } = useLanguage();
  const { createStore } = useApp();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("pinduoduo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createStore({
        name,
        platform,
        currency: "CNY",
        timezone: "Asia/Shanghai",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto mt-10 max-w-lg glass-card p-7">
      <span className="grid size-12 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary">
        <Cloud size={24} />
      </span>
      <h1 className="mt-5 text-2xl font-bold">{t("创建第一个店铺")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("店铺数据会安全保存在云端，并可在手机和电脑间同步。")}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="store-name" className="text-sm font-medium">
            {t("店铺名称")}
          </label>
          <Input
            id="store-name"
            className="mt-2"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder={language === "en-US" ? "e.g. MoonClean Official Store" : "例如：月明净旗舰店"}
            required
          />
        </div>
        <div>
          <label htmlFor="store-platform" className="text-sm font-medium">
            {language === "en-US" ? "Platform" : "经营平台"}
          </label>
          <AppSelect
            id="store-platform"
            className="mt-2 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="pinduoduo">{language === "en-US" ? "Pinduoduo" : "拼多多"}</option>
            <option value="douyin">{language === "en-US" ? "Douyin Shop" : "抖音电商"}</option>
            <option value="other">{language === "en-US" ? "Other platform" : "其他平台"}</option>
          </AppSelect>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--mc-color-danger)]">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} disabled={busy || !name.trim()}>
          {busy ? t("正在创建…") : t("创建店铺")}
        </Button>
      </form>
    </div>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language, t } = useLanguage();
  const {
    data,
    mode,
    loading,
    saving,
    error,
    stores,
    activeStoreId,
    role,
    user,
    dataTransition,
    retry,
    switchStore,
    switchDataMode,
  } = useApp();
  const { level: motionLevel, pageTransitionStyle, reducedMotion } = useMotionPreferences();
  const pageTransitionRef = useRef<HTMLDivElement>(null);
  const [themePreference, setThemePreference] = useState<"system" | "day" | "night">("system");
  const [systemDark, setSystemDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const nightMode = themePreference === "night" || (themePreference === "system" && systemDark);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false);
  const sheetDrag = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const suppressSheetHandleClick = useRef(false);
  const [sheetDragging, setSheetDragging] = useState(false);
  const [customizingNav, setCustomizingNav] = useState(false);
  const [mobilePrimary, setMobilePrimary] = useState(defaultMobilePrimary);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [dataModeDialogOpen, setDataModeDialogOpen] = useState(false);
  const [modeSwitchBusy, setModeSwitchBusy] = useState(false);
  const [modeSwitchError, setModeSwitchError] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setSystemDark(media.matches);
    const syncThemePreference = (event: Event) => {
      const preference = (event as CustomEvent<unknown>).detail;
      if (preference === "night" || preference === "day") {
        setThemePreference(preference);
        setThemeReady(true);
      }
    };
    syncSystem();
    media.addEventListener("change", syncSystem);
    window.addEventListener("moonclean-theme-change", syncThemePreference);
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(themeStorageKey);
        if (saved === "night" || saved === "day") setThemePreference(saved);
      } catch { /* Use the system theme when storage is unavailable. */ }
      setThemeReady(true);
    });
    return () => { window.cancelAnimationFrame(frame); media.removeEventListener("change", syncSystem); window.removeEventListener("moonclean-theme-change", syncThemePreference); };
  }, []);
  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = nightMode ? "night" : "day";
    document.documentElement.style.colorScheme = nightMode ? "dark" : "light";
  }, [nightMode, themeReady]);
  useEffect(() => {
    if (!isRestorableAppRoute(pathname)) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    try {
      document.cookie = `${LAST_VISITED_ROUTE_COOKIE}=${encodeURIComponent(pathname)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // Keep navigation working if browser cookie storage is unavailable.
    }
  }, [pathname]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
    try {
      const saved = localStorage.getItem(mobileNavStorageKey);
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (href): href is string =>
            typeof href === "string" && nav.some((item) => item.href === href),
        );
        if (valid.length === 4 && new Set(valid).size === 4) setMobilePrimary(valid);
      }
    } catch {
      localStorage.removeItem(mobileNavStorageKey);
    }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const root = pageTransitionRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(".glass-card, .material-hero"))
      .filter((element) => !element.parentElement?.closest(".glass-card"));
    if (pageTransitionStyle !== "blur-lift" || motionLevel === "simple" || reducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((element) => element.classList.remove("mc-scroll-reveal", "mc-scroll-reveal-visible"));
      return;
    }

    targets.forEach((element) => {
      element.classList.add("mc-scroll-reveal");
      element.classList.remove("mc-scroll-reveal-visible");
    });
    targets.forEach((element, index) => {
      element.style.setProperty("--mc-scroll-delay", `${Math.min(index * 55, 220)}ms`);
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("mc-scroll-reveal-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    targets.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      targets.forEach((element) => {
        element.classList.remove("mc-scroll-reveal", "mc-scroll-reveal-visible");
        element.style.removeProperty("--mc-scroll-delay");
      });
    };
  }, [pathname, loading, pageTransitionStyle, motionLevel, reducedMotion]);
  if (authPaths.includes(pathname)) return <>{children}</>;
  async function signOut() {
    setLogoutBusy(true); setLogoutError("");
    try {
      const { error } = await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      clearBrowserSessionPolicy();
      window.location.replace("/login");
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "退出失败，请重试");
      setLogoutBusy(false);
    }
  }
  const currentLabel = t(
    nav.find((n) => n.href === pathname)?.label ||
    (
      { "/migrate": "本地数据迁移", "/account": "账号设置" } as Record<
        string,
        string
      >
    )[pathname] ||
    "经营总览");
  function toggleMobileNav(href: string) {
    const next = mobilePrimary.includes(href)
      ? mobilePrimary.length > 2 ? mobilePrimary.filter((item) => item !== href) : mobilePrimary
      : mobilePrimary.length < 4 ? [...mobilePrimary, href] : mobilePrimary;
    setMobilePrimary(next);
    localStorage.setItem(mobileNavStorageKey, JSON.stringify(next));
  }
  function updateMobileNavPointer(event: React.PointerEvent<HTMLElement>) {
    const track = event.currentTarget.querySelector<HTMLElement>(".mobile-primary-nav-track");
    const bounds = (track ?? event.currentTarget).getBoundingClientRect();
    event.currentTarget.style.setProperty("--mobile-pointer-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--mobile-pointer-y", `${event.clientY - bounds.top}px`);
    event.currentTarget.dataset.pointerActive = "true";
  }
  function clearMobileNavPointer(event: React.PointerEvent<HTMLElement>) {
    event.currentTarget.dataset.pointerActive = "false";
  }
  function openMobileMenu() {
    setMobileMenuOpen(true);
  }
  function selectMobileRoute() {
    setMobileMenuOpen(false);
  }
  async function chooseDataMode(next: "local" | "cloud") {
    if (next === mode || modeSwitchBusy) {
      if (next === mode) setDataModeDialogOpen(false);
      return;
    }
    setModeSwitchBusy(true);
    setModeSwitchError("");
    try {
      await switchDataMode(next);
      setDataModeDialogOpen(false);
    } catch (cause) {
      setModeSwitchError(cause instanceof Error ? cause.message : "切换失败，请重试。");
    } finally {
      setModeSwitchBusy(false);
    }
  }
  function cycleTheme() {
    const next = themePreference === "system" ? "day" : themePreference === "day" ? "night" : "system";
    setThemePreference(next);
    try { localStorage.setItem(themeStorageKey, next); } catch { /* Apply the theme for this session. */ }
  }
  function onSheetHandlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const sheet = event.currentTarget.closest<HTMLElement>(".mobile-more-sheet");
    if (!sheet) return;
    sheetDrag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: sheet.getBoundingClientRect().height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSheetDragging(true);
    event.preventDefault();
  }
  function onSheetHandlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = sheetDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const sheet = event.currentTarget.closest<HTMLElement>(".mobile-more-sheet");
    if (!sheet) return;
    const minHeight = window.innerHeight * 0.56;
    const delta = drag.startY - event.clientY;
    if (mobileMenuExpanded || delta < 0) {
      const height = Math.max(minHeight, Math.min(window.innerHeight, drag.startHeight + delta));
      sheet.style.height = `${height}px`;
      sheet.style.translate = "";
    } else {
      sheet.style.height = `${drag.startHeight}px`;
      sheet.style.setProperty("--mobile-more-drag-y", `${Math.max(0, -delta)}px`);
    }
  }
  function onSheetHandlePointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = sheetDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    const sheet = event.currentTarget.closest<HTMLElement>(".mobile-more-sheet");
    sheetDrag.current = null;
    setSheetDragging(false);
    if (Math.abs(delta) > 12) {
      suppressSheetHandleClick.current = true;
      window.setTimeout(() => { suppressSheetHandleClick.current = false; }, 350);
    }
    if (sheet) {
      sheet.style.removeProperty("--mobile-more-drag-y");
      window.requestAnimationFrame(() => sheet.style.removeProperty("height"));
    }
    if (mobileMenuExpanded) {
      if (delta < -55) setMobileMenuExpanded(false);
    } else if (delta > 65) {
      setMobileMenuExpanded(true);
    } else if (delta < -85) {
      setMobileMenuOpen(false);
    }
  }
  const mobileNavItems = nav.filter((item) => mobilePrimary.includes(item.href));
  const activeIndicatorSlot = getMobileNavigationSlot(
    pathname,
    mobileNavItems.map((item) => item.href),
    mobileMenuOpen,
  );
  const indicatorTransform = `translateX(${activeIndicatorSlot * 100}%)`;
  return (
    <div className={cn("app-shell-root min-h-screen md:flex", `motion-level-${motionLevel} page-transition-${pageTransitionStyle}`)}>
      <aside
        className={cn(
          "mc-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border transition-all md:flex",
          collapsed ? "w-[82px]" : "w-[252px]",
        )}
      >
        <div className="flex h-[84px] items-center justify-between border-b border-border px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden"
          >
            <Image src="/yue-ming-jing-logo.png" alt="月明净" width={56} height={56} className="size-12 shrink-0 object-contain" priority />
            {!collapsed && (
              <span className="flex flex-col whitespace-nowrap">
                <span className="text-[17px] font-bold tracking-[-.045em] text-foreground">MoonClean <span className="text-primary">OS</span></span>
                <span className="text-[10px] font-medium tracking-[.16em] text-muted-foreground">月明净智能经营</span>
              </span>
            )}
          </Link>
          <button
            aria-label="切换侧边栏"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--mc-tint-blue)] hover:text-foreground"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-7">
          <p
            className={cn(
              "mb-3 px-3 text-[11px] font-semibold tracking-[.16em] text-muted-foreground",
              collapsed && "sr-only",
            )}
          >
            {t("工作空间")}
          </p>
          <nav className="space-y-1">
            {nav.slice(0, 9).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={t(label)}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[13px] px-3 text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-[var(--mc-tint-blue)] font-semibold text-primary"
                    : "text-muted-foreground hover:bg-[var(--mc-tint-blue)] hover:text-foreground",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={19} strokeWidth={pathname === href ? 2.3 : 1.8} />
                {!collapsed && t(label)}
              </Link>
            ))}
          </nav>
          <p className={cn("mb-3 mt-8 px-3 text-[11px] font-semibold tracking-[.16em] text-muted-foreground", collapsed && "sr-only")}>{language === "en-US" ? "TOOLS & INTEGRATIONS" : "经营工具与连接"}</p>
          <nav className="space-y-1">
            {nav.slice(9).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} title={t(label)} aria-current={pathname === href ? "page" : undefined} className={cn(
                "flex h-11 items-center gap-3 rounded-[13px] px-3 text-sm font-medium transition-colors",
                pathname === href ? "bg-[var(--mc-tint-blue)] font-semibold text-primary" : "text-muted-foreground hover:bg-[var(--mc-tint-blue)] hover:text-foreground",
                collapsed && "justify-center",
              )}>
                <Icon size={19} strokeWidth={pathname === href ? 2.2 : 1.8} />{!collapsed && t(label)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          {!collapsed && (
            <div className="material-subtle rounded-[18px] p-4">
              <div className="mb-1 truncate text-xs font-semibold text-foreground">
                {data?.settings.store.name || t("当前店铺")}
              </div>
              <div className="text-xs text-muted-foreground">
                {mode === "cloud"
                  ? `${t("云端数据")} · ${role ? t(roleLabels[role]) : ""}`
                  : `${t("本地数据")} · ${t("当前设备")}`}
              </div>
            </div>
          )}
          <div className="mt-4 px-2 text-[11px] text-muted-foreground">
            {!collapsed ? `MOONCLEAN OS · ${language === "en-US" ? "WORKSPACE" : "工作台"}` : "OS"}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="mc-toolbar material-standard sticky top-0 z-20 flex h-[62px] flex-nowrap items-center justify-between gap-1 px-3 py-1.5 sm:px-5 md:h-[68px] md:px-9">
          <Link href="/dashboard" aria-label="月明净 MoonClean OS 首页" className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden md:hidden"><Image src="/yue-ming-jing-logo.png" alt="月明净品牌标志" width={64} height={64} className="size-12 object-contain" priority /></Link>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span>{t("工作空间")}</span>
            <ChevronRight size={14} />
            <span className="font-medium text-muted-foreground">{currentLabel}</span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <button type="button" onClick={cycleTheme} title="切换外观" aria-label={`外观：${themePreference === "system" ? "跟随系统" : themePreference === "night" ? "深色" : "浅色"}，点击切换`} className="mc-toolbar-action hidden size-9 items-center justify-center rounded-xl md:inline-flex">
              {nightMode ? <Moon size={17}/> : <Sun size={17}/>}
            </button>
            {mode === "cloud" && stores.length > 0 && (
              <AppSelect
                aria-label={t("切换店铺")}
                disabled={loading||modeSwitchBusy}
                className="max-w-[30vw] rounded-xl border border-border bg-card/75 px-2 py-1.5 text-[11px] font-medium text-foreground sm:max-w-[210px] sm:px-2.5 sm:py-2 sm:text-xs"
                value={activeStoreId || ""}
                onChange={(e) => void switchStore(e.target.value).catch(() => {})}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </AppSelect>
            )}
            <button type="button" onClick={() => { setModeSwitchError(""); setDataModeDialogOpen(true); }} disabled={loading||modeSwitchBusy} aria-label={language === "en-US" ? "Switch local or cloud data" : "切换本地数据或云端数据"} title={t("选择数据存储位置")} className={cn(
              "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border px-2 py-1.5 text-[10px] font-semibold transition-colors hover:bg-[var(--mc-tint-green)] disabled:opacity-60 sm:gap-1.5 sm:px-2.5 sm:text-[11px]",
              error
                ? "bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]"
                : "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]",
            )}>
              <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />{mode === "local" ? error ? t("本地异常") : saving ? t("本机保存中…") : t("本地数据") : error ? t("云端异常") : saving ? t("保存中…") : t("云端数据")}<ChevronDown size={12}/>
            </button>
            {mode === "cloud" && (
              <>
                <Link
                  href="/account"
                  title="账号设置"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--mc-tint-blue)] text-primary sm:size-9"
                >
                  <CircleUserRound size={18} />
                </Link>
                <button
                  aria-label="退出登录"
                  title="退出登录"
                  disabled={logoutBusy}
                  onClick={signOut}
                  className="shrink-0 p-1 text-muted-foreground hover:text-[var(--mc-color-danger)]"
                >
                  <LogOut size={17} />
                </button>
              </>
            )}
            {mode === "local" && user && <button type="button" aria-label="退出登录" title="退出登录" disabled={logoutBusy} onClick={signOut} className="shrink-0 p-1 text-muted-foreground hover:text-[var(--mc-color-danger)]"><LogOut size={17}/></button>}
          </div>
        </header>
        <main key={mode} className="mx-auto max-w-[1530px] px-5 pb-28 pt-7 md:px-9 md:pb-12 md:pt-10">
          {logoutError && <div role="alert" className="mb-4 rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]">{logoutError}</div>}
          {error && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-[var(--mc-tint-red)] px-5 py-4 text-sm text-[var(--mc-color-danger)]"
            >
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => void retry()}>
                <RefreshCw size={14} />
                重试
              </Button>
            </div>
          )}
          {saving && (
            <div role="status" aria-live="polite" className="mc-saving-status mb-4 flex items-center gap-2 overflow-hidden rounded-xl border border-border bg-card/85 px-3 py-2.5 text-xs text-primary">
              <LoaderCircle size={15} className="mc-motion-spinner shrink-0" aria-hidden="true" />
              <span>{mode === "local" ? "正在保存到此设备…" : "正在保存到云端…"}</span>
              <span aria-hidden="true" className="mc-saving-glide" />
            </div>
          )}
          <div key={pathname} ref={pageTransitionRef} className="app-page-transition">
            {loading ? (
              <div className="mc-workspace-skeleton" role="status" aria-label="正在加载店铺数据">
                <span className="sr-only">正在加载店铺数据…</span>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">{Array.from({length:4},(_,index)=><div key={index} className="glass-card p-4"><Skeleton className="h-3 w-20"/><Skeleton className="mt-4 h-7 w-28"/><Skeleton className="mt-3 h-3 w-24"/></div>)}</div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <div className="glass-card p-4 md:p-6"><Skeleton className="h-4 w-32"/><Skeleton className="mt-2 h-3 w-52"/><div className="mt-6 flex h-44 items-end gap-2">{[42,65,50,78,57,88,68,74,52,80,61].map((height,index)=><Skeleton key={index} className="flex-1 rounded-t-md" style={{height:`${height}%`}}/>)}</div></div>
                  <div className="glass-card space-y-4 p-4 md:p-6"><Skeleton className="h-4 w-28"/>{Array.from({length:4},(_,index)=><div key={index} className="flex items-center gap-3"><Skeleton className="size-8 rounded-xl"/><div className="flex-1"><Skeleton className="h-3 w-4/5"/><Skeleton className="mt-2 h-2.5 w-2/5"/></div></div>)}</div>
                </div>
                <LoadingElapsed />
              </div>
            ) : mode === "cloud" && !activeStoreId && !error ? (
              <StoreOnboarding />
            ) : error && !data ? null : (
              children
            )}
          </div>
        </main>
      </div>
      <nav aria-label="主导航" onPointerMove={updateMobileNavPointer} onPointerDown={updateMobileNavPointer} onPointerLeave={clearMobileNavPointer} className={cn("mobile-primary-nav material-standard fixed inset-x-3 bottom-[max(8px,env(safe-area-inset-bottom))] z-30 rounded-[23px] p-1.5 md:hidden", `mobile-primary-nav-${motionLevel}`)}>
        <div className="mobile-primary-nav-track relative grid grid-cols-5">
          <span aria-hidden="true" className="mobile-active-indicator pointer-events-none absolute inset-y-0.5 left-0 w-1/5 rounded-[16px] border border-white/70 bg-[var(--mc-tint-blue)]/90 shadow-[0_2px_8px_rgba(31,91,150,0.1)] transition-transform duration-300 ease-out" style={{ transform: indicatorTransform } as React.CSSProperties}>
            {motionLevel === "refined" && <span className="mobile-active-spectrum"/>}
            {motionLevel === "refined" && <><i/><i/><i/><i/></>}
          </span>
          {motionLevel === "refined" && <span aria-hidden="true" className="mobile-nav-touch-glow"/>}
          {mobileNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("relative z-10 flex min-w-0 flex-col items-center gap-1 rounded-[16px] py-2 text-[10px] font-semibold transition-colors duration-200", active ? "text-primary" : "text-muted-foreground")}>
              <Icon size={20} strokeWidth={active ? 2.3 : 1.9} /><span className="truncate">{t(label)}</span>
            </Link>;
          })}
          <button type="button" aria-label={t("更多功能")} aria-expanded={mobileMenuOpen} aria-current={!mobilePrimary.includes(pathname) ? "page" : undefined} onClick={openMobileMenu} className={cn("relative z-10 flex min-w-0 flex-col items-center gap-1 rounded-[16px] py-2 text-[10px] font-semibold transition-colors duration-200", mobileMenuOpen || !mobilePrimary.includes(pathname) ? "text-primary" : "text-muted-foreground")}>
            <Menu size={20}/><span>{t("更多")}</span>
          </button>
        </div>
      </nav>
      <Sheet open={mobileMenuOpen} onOpenChange={(open) => { setMobileMenuOpen(open); if (open) setMobileMenuExpanded(false); }}>
        <SheetContent side="bottom" className={cn("mobile-more-sheet overflow-y-auto rounded-[28px] border-border bg-card/95 p-5 pb-[max(22px,env(safe-area-inset-bottom))] shadow-[0_24px_70px_rgba(31,57,82,0.20)] backdrop-blur-2xl md:hidden", mobileMenuExpanded && "is-expanded", sheetDragging && "is-dragging")}>
          <button type="button" aria-label={language === "en-US" ? (mobileMenuExpanded ? "Collapse menu" : "Expand menu") : (mobileMenuExpanded ? "下滑收起更多功能" : "上滑展开更多功能")} onPointerDown={onSheetHandlePointerDown} onPointerMove={onSheetHandlePointerMove} onPointerUp={onSheetHandlePointerEnd} onPointerCancel={onSheetHandlePointerEnd} onClick={() => { if (suppressSheetHandleClick.current) { suppressSheetHandleClick.current = false; return; } setMobileMenuExpanded(value => !value); }} className="mobile-more-drag-handle mx-auto mb-2 flex h-6 w-16 touch-none items-center justify-center" title={language === "en-US" ? "Drag to expand or collapse" : "上下滑动展开或收起"}>
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[var(--mc-tint-blue)]" />
          </button>
          <SheetHeader className="px-1 pb-4 text-left">
            <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={21}/></div>
            <SheetTitle className="text-xl">{t("更多功能")}</SheetTitle>
            <p className="text-sm text-muted-foreground">{t("常用经营工具与系统管理")}</p>
          </SheetHeader>
          <button type="button" aria-label={t("切换外观")} onClick={cycleTheme} className="mb-4 flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted">
            <span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary">{nightMode ? <Moon size={18}/> : <Sun size={18}/>}</span><span><span className="block text-sm font-semibold text-foreground">{t("外观模式")}</span><span className="mt-0.5 block text-xs text-muted-foreground">{themePreference === "system" ? t("跟随系统") : themePreference === "night" ? t("深色") : t("浅色")} · {t("点击切换")}</span></span></span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
          <button type="button" onClick={() => setCustomizingNav((value) => !value)} className="mb-5 flex w-full items-center justify-between rounded-2xl border border-border bg-gradient-to-r from-[var(--mc-tint-blue)] to-card p-4 text-left transition-colors hover:bg-[var(--mc-tint-blue)]">
            <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-card text-primary shadow-sm"><SlidersHorizontal size={19}/></span><span><span className="block text-sm font-semibold text-foreground">{t("自定义底栏")}</span><span className="mt-0.5 block text-xs text-muted-foreground">{t("选择常用入口，最多显示 4 个")}</span></span></span>
            <ChevronRight size={18} className={cn("text-muted-foreground transition-transform", customizingNav && "rotate-90")}/>
          </button>
          {customizingNav && <div className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{t("底栏快捷入口")}</p><span className="text-xs text-muted-foreground">{t("已选")} {mobilePrimary.length}/4</span></div><div className="grid grid-cols-2 gap-2">{nav.map(({href,label,icon:Icon}) => { const selected = mobilePrimary.includes(href); return <button key={href} type="button" aria-pressed={selected} onClick={() => toggleMobileNav(href)} disabled={!selected && mobilePrimary.length >= 4} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45", selected ? "border-border bg-[var(--mc-tint-blue)] text-primary" : "border-border bg-card text-muted-foreground")}><Icon size={17}/><span className="flex-1 truncate">{t(label)}</span><span className={cn("grid size-4 place-items-center rounded-full border", selected ? "border-border bg-primary text-primary-foreground" : "border-border")}>{selected && <Check size={11}/>}</span></button>; })}</div><button type="button" onClick={() => { setMobilePrimary(defaultMobilePrimary); localStorage.setItem(mobileNavStorageKey, JSON.stringify(defaultMobilePrimary)); }} className="mt-3 text-xs font-medium text-muted-foreground hover:text-primary">{t("恢复默认底栏")}</button></div>}
          <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground">{t("经营工具")}</p>
          <div className="grid grid-cols-2 gap-2">
            {nav.filter(item => !mobilePrimary.includes(item.href) && !["/settings", "/motion", "/integrations", "/sync-center"].includes(item.href)).map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={selectMobileRoute} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-medium transition-colors", pathname===href ? "border-border bg-[var(--mc-tint-blue)] text-primary" : "border-border bg-card text-foreground hover:border-border hover:bg-[var(--mc-tint-blue)]")}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Icon size={18}/></span>{t(label)}</Link>)}
          </div>
          <p className="mb-2 mt-5 px-1 text-xs font-semibold tracking-wide text-muted-foreground">{t("系统与账号")}</p>
          <div className="grid grid-cols-2 gap-2">
            {nav.filter(item => !mobilePrimary.includes(item.href) && ["/settings", "/ai-settings", "/motion", "/integrations", "/sync-center"].includes(item.href)).map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={selectMobileRoute} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-medium transition-colors", pathname===href ? "border-border bg-[var(--mc-tint-blue)] text-primary" : "border-border bg-card text-foreground hover:border-border hover:bg-[var(--mc-tint-blue)]")}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Icon size={18}/></span>{t(label)}</Link>)}
            {mode==="cloud"&&<Link href="/account" onClick={selectMobileRoute} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm font-medium text-foreground"><span className="grid size-9 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><CircleUserRound size={18}/></span>账号设置</Link>}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={dataModeDialogOpen} onOpenChange={open=>{if(!modeSwitchBusy)setDataModeDialogOpen(open);}}>
        <DialogContent className="rounded-[28px] border border-border p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">{t("选择数据存储位置")}</DialogTitle>
            <DialogDescription className="leading-6">{t("切换只会更改当前读取的数据源，不会自动复制或合并两边的数据。")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["cloud","local"] as const).map(target=>{
              const active=mode===target;
              return <button key={target} type="button" disabled={modeSwitchBusy||loading} onClick={()=>void chooseDataMode(target)} className={cn("rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-60",active?"border-border bg-[var(--mc-tint-blue)] shadow-[inset_0_0_0_1px_#d5eaff]":"border-border bg-card hover:border-border")}>
                <span className={cn("mb-3 grid size-10 place-items-center rounded-xl",target==="cloud"?"bg-[var(--mc-tint-blue)] text-primary":"bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]")}>{target==="cloud"?<Cloud size={20}/>:<HardDrive size={20}/>}</span>
                <span className="block text-sm font-semibold text-foreground">{target==="cloud"?t("云端数据"):t("本地数据")}{active&&<span className="ml-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-primary">{t("当前使用")}</span>}</span>
                <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{target==="cloud"?t("安全保存在云端，手机和电脑可同步，支持店铺与团队协作。"):t("保存在此设备的浏览器中；不会自动上传或跨设备同步。")}</span>
              </button>;
            })}
          </div>
          {modeSwitchError&&<p role="alert" className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]">{modeSwitchError}</p>}
          {modeSwitchError.includes("登录")&&<Link href="/login" onClick={()=>setDataModeDialogOpen(false)} className="text-sm font-semibold text-primary">前往登录云端账号 →</Link>}
          <p className="text-xs leading-5 text-muted-foreground">{t("本地与云端数据相互独立。需要迁移数据时，请使用“本地数据迁移”向导。")}</p>
        </DialogContent>
      </Dialog>
      <PerformanceDebugCapsule motionLevel={motionLevel} dataMode={mode}/>
      <FeedbackViewport />
      <DataTransitionOverlay transition={dataTransition}/>
    </div>
  );
}
