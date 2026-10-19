"use client";
import { AppSelect } from "@/components/ui/app-select";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "./app-provider";
import { getMobileNavigationSlot } from "@/lib/mobile-navigation";
import { DataTransitionOverlay } from "@/components/data-transition-overlay";
import { PerformanceDebugCapsule } from "@/components/performance-debug-capsule";
import { FeedbackViewport } from "@/components/feedback-viewport";
import { Skeleton } from "@/components/ui/skeleton";
import { useMotionPreferences } from "@/components/motion-preferences";
const nav = [
  { href: "/dashboard", label: "经营总览", icon: LayoutDashboard },
  { href: "/advertising", label: "推广分析", icon: Megaphone },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/orders", label: "订单中心", icon: ShoppingCart },
  { href: "/inventory", label: "库存管理", icon: Boxes },
  { href: "/tasks", label: "运营待办", icon: ClipboardCheck },
  { href: "/notes", label: "运营备忘录", icon: NotebookPen },
  { href: "/copilot", label: "AI 运营助手", icon: BrainCircuit },
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
      <span className="grid size-12 place-items-center rounded-2xl bg-[#e8f5ff] text-[#3b91eb]">
        <Cloud size={24} />
      </span>
      <h1 className="mt-5 text-2xl font-bold">创建第一个店铺</h1>
      <p className="mt-2 text-sm text-[#8194a8]">
        店铺数据会安全保存在云端，并可在手机和电脑间同步。
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="store-name" className="text-sm font-medium">
            店铺名称
          </label>
          <Input
            id="store-name"
            className="mt-2"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：月明净旗舰店"
            required
          />
        </div>
        <div>
          <label htmlFor="store-platform" className="text-sm font-medium">
            经营平台
          </label>
          <AppSelect
            id="store-platform"
            className="mt-2 flex h-9 w-full rounded-md border border-[#dfeaf4] bg-white px-3 text-sm"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="pinduoduo">拼多多</option>
            <option value="douyin">抖音电商</option>
            <option value="other">其他平台</option>
          </AppSelect>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[#e85d65]">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} disabled={busy || !name.trim()}>
          {busy ? "正在创建…" : "创建店铺"}
        </Button>
      </form>
    </div>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
  const { level: motionLevel, pageTransitionStyle } = useMotionPreferences();
  const [nightMode, setNightMode] = useState(false);
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
    const frame = window.requestAnimationFrame(() => {
      let enabled = false;
      try { enabled = localStorage.getItem(themeStorageKey) === "night"; } catch { /* Keep the light default when storage is unavailable. */ }
      setNightMode(enabled);
      document.documentElement.dataset.theme = enabled ? "night" : "day";
      document.documentElement.style.colorScheme = enabled ? "dark" : "light";
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
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
  if (authPaths.includes(pathname)) return <>{children}</>;
  async function signOut() {
    setLogoutBusy(true); setLogoutError("");
    try {
      const { error } = await createBrowserSupabaseClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "退出失败，请重试");
      setLogoutBusy(false);
    }
  }
  const currentLabel =
    nav.find((n) => n.href === pathname)?.label ||
    (
      { "/migrate": "本地数据迁移", "/account": "账号设置" } as Record<
        string,
        string
      >
    )[pathname] ||
    "经营总览";
  function toggleMobileNav(href: string) {
    const next = mobilePrimary.includes(href)
      ? mobilePrimary.length > 2 ? mobilePrimary.filter((item) => item !== href) : mobilePrimary
      : mobilePrimary.length < 4 ? [...mobilePrimary, href] : mobilePrimary;
    setMobilePrimary(next);
    localStorage.setItem(mobileNavStorageKey, JSON.stringify(next));
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
  function toggleNightMode() {
    const next = !nightMode;
    setNightMode(next);
    document.documentElement.dataset.theme = next ? "night" : "day";
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try { localStorage.setItem(themeStorageKey, next ? "night" : "day"); } catch { /* Apply the theme for this session even when storage is unavailable. */ }
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
      sheet.style.translate = `0 ${Math.max(0, -delta)}px`;
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
      sheet.style.translate = "";
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
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#eaedf1] bg-white transition-all md:flex",
          collapsed ? "w-[82px]" : "w-[252px]",
        )}
      >
        <div className="flex h-[84px] items-center justify-between border-b border-[#f0f2f5] px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden"
          >
            <Image src="/yue-ming-jing-logo.png" alt="月明净" width={56} height={56} className="size-12 shrink-0 object-contain" priority />
            {!collapsed && (
              <span className="flex flex-col whitespace-nowrap">
                <span className="text-[17px] font-bold tracking-[-.045em] text-[#202936]">MoonClean <span className="text-[#287fe2]">OS</span></span>
                <span className="text-[10px] font-medium tracking-[.16em] text-[#98a3af]">月明净智能经营</span>
              </span>
            )}
          </Link>
          <button
            aria-label="切换侧边栏"
            className="rounded-lg p-1.5 text-[#9aa5b1] hover:bg-[#f2f5f8] hover:text-[#202936]"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-7">
          <p
            className={cn(
              "mb-3 px-3 text-[11px] font-semibold tracking-[.16em] text-[#9ca7b4]",
              collapsed && "sr-only",
            )}
          >
            工作空间
          </p>
          <nav className="space-y-1">
            {nav.slice(0, 9).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[13px] px-3 text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-[#eaf2fd] font-semibold text-[#287fe2]"
                    : "text-[#6f7d8d] hover:bg-[#f5f7f9] hover:text-[#202936]",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={19} strokeWidth={pathname === href ? 2.3 : 1.8} />
                {!collapsed && label}
              </Link>
            ))}
          </nav>
          <p className={cn("mb-3 mt-8 px-3 text-[11px] font-semibold tracking-[.16em] text-[#9ca7b4]", collapsed && "sr-only")}>经营工具与连接</p>
          <nav className="space-y-1">
            {nav.slice(9).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} title={label} className={cn(
                "flex h-11 items-center gap-3 rounded-[13px] px-3 text-sm font-medium transition-colors",
                pathname === href ? "bg-[#eaf2fd] font-semibold text-[#287fe2]" : "text-[#6f7d8d] hover:bg-[#f5f7f9] hover:text-[#202936]",
                collapsed && "justify-center",
              )}>
                <Icon size={19} strokeWidth={pathname === href ? 2.2 : 1.8} />{!collapsed && label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          {!collapsed && (
            <div className="rounded-[18px] border border-[#e8edf2] bg-[#f7f9fb] p-4">
              <div className="mb-1 truncate text-xs font-semibold text-[#202936]">
                {data?.settings.store.name || "当前店铺"}
              </div>
              <div className="text-xs text-[#8fa1b3]">
                {mode === "cloud"
                  ? `云端数据 · ${role ? roleLabels[role] : ""}`
                  : "本地数据 · 当前设备"}
              </div>
            </div>
          )}
          <div className="mt-4 px-2 text-[11px] text-[#a8b3bf]">
            {!collapsed ? "MOONCLEAN OS · 工作台" : "OS"}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[62px] flex-nowrap items-center justify-between gap-1 border-b border-white/80 bg-white/82 px-3 py-1.5 shadow-[0_3px_18px_rgba(31,57,82,0.045)] backdrop-blur-md sm:px-5 md:h-[68px] md:px-9">
          <Link href="/dashboard" aria-label="月明净 MoonClean OS 首页" className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden md:hidden"><Image src="/yue-ming-jing-logo.png" alt="月明净品牌标志" width={64} height={64} className="size-12 object-contain" priority /></Link>
          <div className="hidden items-center gap-2 text-xs text-[#92a0ae] md:flex">
            <span>工作空间</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#45617d]">{currentLabel}</span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            {mode === "cloud" && stores.length > 0 && (
              <AppSelect
                aria-label="切换店铺"
                disabled={loading||modeSwitchBusy}
                className="max-w-[30vw] rounded-xl border border-[#e4e9ef] bg-white/75 px-2 py-1.5 text-[11px] font-medium text-[#39485a] sm:max-w-[210px] sm:px-2.5 sm:py-2 sm:text-xs"
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
            <button type="button" onClick={() => { setModeSwitchError(""); setDataModeDialogOpen(true); }} disabled={loading||modeSwitchBusy} aria-label="切换本地数据或云端数据" title="切换数据存储位置" className={cn(
              "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#d9f0e8] px-2 py-1.5 text-[10px] font-semibold transition-colors hover:bg-[#dff4ee] disabled:opacity-60 sm:gap-1.5 sm:px-2.5 sm:text-[11px]",
              error
                ? "bg-[#fff0f1] text-[#e85d65]"
                : "bg-[#e9f7f3] text-[#16a085]",
            )}>
              <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />{mode === "local" ? error ? "本地异常" : saving ? "本机保存中…" : "本地数据" : error ? "云端异常" : saving ? "保存中…" : "云端数据"}<ChevronDown size={12}/>
            </button>
            {mode === "cloud" && (
              <>
                <Link
                  href="/account"
                  title="账号设置"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edf3fb] text-[#287fe2] sm:size-9"
                >
                  <CircleUserRound size={18} />
                </Link>
                <button
                  aria-label="退出登录"
                  title="退出登录"
                  disabled={logoutBusy}
                  onClick={signOut}
                  className="shrink-0 p-1 text-[#8fa1b3] hover:text-[#e85d65]"
                >
                  <LogOut size={17} />
                </button>
              </>
            )}
            {mode === "local" && user && <button type="button" aria-label="退出登录" title="退出登录" disabled={logoutBusy} onClick={signOut} className="shrink-0 p-1 text-[#8fa1b3] hover:text-[#e85d65]"><LogOut size={17}/></button>}
          </div>
        </header>
        <main key={mode} className="mx-auto max-w-[1530px] px-5 pb-28 pt-7 md:px-9 md:pb-12 md:pt-10">
          {nightMode && <div role="status" className="mb-4 rounded-xl border border-[#dce5ef] bg-white/70 px-3 py-2 text-xs text-[#718196]">当前为 0.9.3 旧预览版本，不会为新变化做适配</div>}
          {logoutError && <div role="alert" className="mb-4 rounded-xl bg-[#fff0f1] p-3 text-sm text-[#e85d65]">{logoutError}</div>}
          {error && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f5d7da] bg-[#fff4f5] px-5 py-4 text-sm text-[#b9555d]"
            >
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => void retry()}>
                <RefreshCw size={14} />
                重试
              </Button>
            </div>
          )}
          {saving && (
            <div role="status" aria-live="polite" className="mc-saving-status mb-4 flex items-center gap-2 overflow-hidden rounded-xl border border-[#dcecff] bg-white/85 px-3 py-2.5 text-xs text-[#3b91eb]">
              <LoaderCircle size={15} className="mc-motion-spinner shrink-0" aria-hidden="true" />
              <span>{mode === "local" ? "正在保存到此设备…" : "正在保存到云端…"}</span>
              <span aria-hidden="true" className="mc-saving-glide" />
            </div>
          )}
          {loading ? (
            <div className="mc-workspace-skeleton" role="status" aria-label="正在加载店铺数据">
              <span className="sr-only">正在加载店铺数据…</span>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">{Array.from({length:4},(_,index)=><div key={index} className="glass-card p-4"><Skeleton className="h-3 w-20"/><Skeleton className="mt-4 h-7 w-28"/><Skeleton className="mt-3 h-3 w-24"/></div>)}</div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <div className="glass-card p-4 md:p-6"><Skeleton className="h-4 w-32"/><Skeleton className="mt-2 h-3 w-52"/><div className="mt-6 flex h-44 items-end gap-2">{[42,65,50,78,57,88,68,74,52,80,61].map((height,index)=><Skeleton key={index} className="flex-1 rounded-t-md" style={{height:`${height}%`}}/>)}</div></div>
                <div className="glass-card space-y-4 p-4 md:p-6"><Skeleton className="h-4 w-28"/>{Array.from({length:4},(_,index)=><div key={index} className="flex items-center gap-3"><Skeleton className="size-8 rounded-xl"/><div className="flex-1"><Skeleton className="h-3 w-4/5"/><Skeleton className="mt-2 h-2.5 w-2/5"/></div></div>)}</div>
              </div>
            </div>
          ) : mode === "cloud" && !activeStoreId && !error ? (
            <StoreOnboarding />
          ) : error && !data ? null : (
            children
          )}
        </main>
      </div>
      <nav aria-label="主导航" className={cn("mobile-primary-nav fixed inset-x-3 bottom-[max(8px,env(safe-area-inset-bottom))] z-30 rounded-[23px] border border-white/80 bg-white/72 p-1.5 shadow-[0_8px_28px_rgba(31,57,82,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md md:hidden", `mobile-primary-nav-${motionLevel}`)}>
        <div className="relative grid grid-cols-5">
          <span aria-hidden="true" className="mobile-active-indicator pointer-events-none absolute inset-y-0.5 left-0 w-1/5 rounded-[16px] border border-white/70 bg-[#e8f4ff]/90 shadow-[0_2px_8px_rgba(31,91,150,0.1)] transition-transform duration-300 ease-out" style={{ transform: indicatorTransform } as React.CSSProperties}>
            {motionLevel === "refined" && <span className="mobile-active-spectrum"/>}
            {motionLevel === "refined" && <><i/><i/><i/><i/></>}
          </span>
          {mobileNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("relative z-10 flex min-w-0 flex-col items-center gap-1 rounded-[16px] py-2 text-[10px] font-semibold transition-colors duration-200", active ? "text-[#287fe2]" : "text-[#798898]")}>
              <Icon size={20} strokeWidth={active ? 2.3 : 1.9} /><span className="truncate">{label}</span>
            </Link>;
          })}
          <button type="button" aria-label="更多功能" aria-expanded={mobileMenuOpen} aria-current={!mobilePrimary.includes(pathname) ? "page" : undefined} onClick={() => setMobileMenuOpen(true)} className={cn("relative z-10 flex min-w-0 flex-col items-center gap-1 rounded-[16px] py-2 text-[10px] font-semibold transition-colors duration-200", mobileMenuOpen || !mobilePrimary.includes(pathname) ? "text-[#287fe2]" : "text-[#798898]")}>
            <Menu size={20}/><span>更多</span>
          </button>
        </div>
      </nav>
      <Sheet open={mobileMenuOpen} onOpenChange={(open) => { setMobileMenuOpen(open); if (open) setMobileMenuExpanded(false); }}>
        <SheetContent side="bottom" className={cn("mobile-more-sheet overflow-y-auto rounded-t-[28px] border-[#e5edf5] bg-white/95 p-5 pb-[max(22px,env(safe-area-inset-bottom))] shadow-[0_-16px_50px_rgba(31,57,82,0.16)] backdrop-blur-2xl md:hidden", mobileMenuExpanded && "is-expanded", sheetDragging && "is-dragging")}>
          <button type="button" aria-label={mobileMenuExpanded ? "下滑收起更多功能" : "上滑展开更多功能"} onPointerDown={onSheetHandlePointerDown} onPointerMove={onSheetHandlePointerMove} onPointerUp={onSheetHandlePointerEnd} onPointerCancel={onSheetHandlePointerEnd} onClick={() => { if (suppressSheetHandleClick.current) { suppressSheetHandleClick.current = false; return; } setMobileMenuExpanded(value => !value); }} className="mobile-more-drag-handle mx-auto mb-2 flex h-6 w-16 touch-none items-center justify-center" title="上下滑动展开或收起">
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[#c7d3df]" />
          </button>
          <SheetHeader className="px-1 pb-4 text-left">
            <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#eaf4ff] text-[#3189e8]"><Sparkles size={21}/></div>
            <SheetTitle className="text-xl">更多功能</SheetTitle>
            <p className="text-sm text-[#8192a3]">常用经营工具与系统管理</p>
          </SheetHeader>
          <button type="button" aria-label={nightMode ? "切换日间模式" : "切换夜间模式"} aria-pressed={nightMode} onClick={toggleNightMode} className="mb-4 flex w-full items-center justify-between rounded-2xl border border-[#e5edf5] bg-white p-3.5 text-left transition-colors hover:bg-[#f7fbff]">
            <span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eef6ff] text-[#3189e8]">{nightMode ? <Sun size={18}/> : <Moon size={18}/>}</span><span><span className="block text-sm font-semibold text-[#203751]">夜间模式</span><span className="mt-0.5 block text-xs text-[#8294a8]">{nightMode ? "已开启 · 点击切换日间" : "已关闭 · 点击切换夜间"}</span></span></span>
            <span className={cn("relative h-6 w-11 rounded-full transition-colors", nightMode ? "bg-[#3189e8]" : "bg-[#d5dee7]")}><span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform", nightMode ? "translate-x-[22px]" : "translate-x-0.5")}/></span>
          </button>
          <button type="button" onClick={() => setCustomizingNav((value) => !value)} className="mb-5 flex w-full items-center justify-between rounded-2xl border border-[#dcecff] bg-gradient-to-r from-[#f1f8ff] to-white p-4 text-left transition-colors hover:bg-[#eaf4ff]">
            <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-[#3189e8] shadow-sm"><SlidersHorizontal size={19}/></span><span><span className="block text-sm font-semibold text-[#203751]">自定义底栏</span><span className="mt-0.5 block text-xs text-[#8294a8]">选择常用入口，最多显示 4 个</span></span></span>
            <ChevronRight size={18} className={cn("text-[#8ba0b4] transition-transform", customizingNav && "rotate-90")}/>
          </button>
          {customizingNav && <div className="mb-5 rounded-2xl border border-[#e8eef4] bg-[#fbfdff] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-[#243c56]">底栏快捷入口</p><span className="text-xs text-[#8799ab]">已选 {mobilePrimary.length}/4</span></div><div className="grid grid-cols-2 gap-2">{nav.map(({href,label,icon:Icon}) => { const selected = mobilePrimary.includes(href); return <button key={href} type="button" aria-pressed={selected} onClick={() => toggleMobileNav(href)} disabled={!selected && mobilePrimary.length >= 4} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45", selected ? "border-[#b8d9fb] bg-[#eef7ff] text-[#287fe2]" : "border-[#edf1f5] bg-white text-[#536579]")}><Icon size={17}/><span className="flex-1 truncate">{label}</span><span className={cn("grid size-4 place-items-center rounded-full border", selected ? "border-[#3b91eb] bg-[#3b91eb] text-white" : "border-[#d7e0e9]")}>{selected && <Check size={11}/>}</span></button>; })}</div><button type="button" onClick={() => { setMobilePrimary(defaultMobilePrimary); localStorage.setItem(mobileNavStorageKey, JSON.stringify(defaultMobilePrimary)); }} className="mt-3 text-xs font-medium text-[#66809a] hover:text-[#287fe2]">恢复默认底栏</button></div>}
          <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-[#94a4b4]">经营工具</p>
          <div className="grid grid-cols-2 gap-2">
            {nav.filter(item => !mobilePrimary.includes(item.href) && !["/settings", "/integrations", "/sync-center"].includes(item.href)).map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-medium transition-colors", pathname===href ? "border-[#c8e1fb] bg-[#eef7ff] text-[#287fe2]" : "border-[#edf1f5] bg-white text-[#42566b] hover:border-[#d7e9fb] hover:bg-[#f7fbff]")}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2f7fb] text-[#5b83aa]"><Icon size={18}/></span>{label}</Link>)}
          </div>
          <p className="mb-2 mt-5 px-1 text-xs font-semibold tracking-wide text-[#94a4b4]">系统与账号</p>
          <div className="grid grid-cols-2 gap-2">
            {nav.filter(item => !mobilePrimary.includes(item.href) && ["/settings", "/integrations", "/sync-center"].includes(item.href)).map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-medium transition-colors", pathname===href ? "border-[#c8e1fb] bg-[#eef7ff] text-[#287fe2]" : "border-[#edf1f5] bg-white text-[#42566b] hover:border-[#d7e9fb] hover:bg-[#f7fbff]")}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2f7fb] text-[#5b83aa]"><Icon size={18}/></span>{label}</Link>)}
            {mode==="cloud"&&<Link href="/account" onClick={()=>setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-2xl border border-[#edf1f5] bg-white p-3.5 text-sm font-medium text-[#42566b]"><span className="grid size-9 place-items-center rounded-xl bg-[#f2f7fb] text-[#5b83aa]"><CircleUserRound size={18}/></span>账号设置</Link>}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={dataModeDialogOpen} onOpenChange={open=>{if(!modeSwitchBusy)setDataModeDialogOpen(open);}}>
        <DialogContent className="rounded-[28px] border border-[#e3edf6] p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#172b45]">选择数据存储位置</DialogTitle>
            <DialogDescription className="leading-6">切换只会更改当前读取的数据源，不会自动复制或合并两边的数据。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["cloud","local"] as const).map(target=>{
              const active=mode===target;
              return <button key={target} type="button" disabled={modeSwitchBusy||loading} onClick={()=>void chooseDataMode(target)} className={cn("rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-60",active?"border-[#9cccf8] bg-[#f0f8ff] shadow-[inset_0_0_0_1px_#d5eaff]":"border-[#e6edf3] bg-white hover:border-[#c8def1]")}>
                <span className={cn("mb-3 grid size-10 place-items-center rounded-xl",target==="cloud"?"bg-[#e8f5ff] text-[#3189e8]":"bg-[#eaf7f2] text-[#15987c]")}>{target==="cloud"?<Cloud size={20}/>:<HardDrive size={20}/>}</span>
                <span className="block text-sm font-semibold text-[#253b53]">{target==="cloud"?"云端数据":"本地数据"}{active&&<span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#4581b2]">当前使用</span>}</span>
                <span className="mt-1.5 block text-xs leading-5 text-[#8092a4]">{target==="cloud"?"安全保存在云端，手机和电脑可同步，支持店铺与团队协作。":"保存在此设备的浏览器中；不会自动上传或跨设备同步。"}</span>
              </button>;
            })}
          </div>
          {modeSwitchError&&<p role="alert" className="rounded-xl bg-[#fff0f1] p-3 text-sm text-[#d35760]">{modeSwitchError}</p>}
          {modeSwitchError.includes("登录")&&<Link href="/login" onClick={()=>setDataModeDialogOpen(false)} className="text-sm font-semibold text-[#287fe2]">前往登录云端账号 →</Link>}
          <p className="text-xs leading-5 text-[#91a0af]">本地与云端数据相互独立。需要迁移数据时，请使用“本地数据迁移”向导。</p>
        </DialogContent>
      </Dialog>
      <PerformanceDebugCapsule motionLevel={motionLevel} dataMode={mode}/>
      <FeedbackViewport />
      <DataTransitionOverlay transition={dataTransition}/>
    </div>
  );
}
