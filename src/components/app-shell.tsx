"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Wallet,
  Database,
  Settings,
  Moon,
  ChevronRight,
  PanelLeftClose,
  LogOut,
  CircleUserRound,
  RefreshCw,
  Cloud,
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "./app-provider";
const nav = [
  { href: "/dashboard", label: "经营总览", icon: LayoutDashboard },
  { href: "/advertising", label: "推广分析", icon: Megaphone },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/orders", label: "订单中心", icon: ShoppingCart },
  { href: "/inventory", label: "库存管理", icon: Boxes },
  { href: "/tasks", label: "运营待办", icon: ClipboardCheck },
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
          <select
            id="store-platform"
            className="mt-2 flex h-9 w-full rounded-md border border-[#dfeaf4] bg-white px-3 text-sm"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="pinduoduo">拼多多</option>
            <option value="douyin">抖音电商</option>
            <option value="other">其他平台</option>
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[#e85d65]">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !name.trim()}>
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
    retry,
    switchStore,
  } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customizingNav, setCustomizingNav] = useState(false);
  const [mobilePrimary, setMobilePrimary] = useState(defaultMobilePrimary);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
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
  return (
    <div className="min-h-screen md:flex">
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
            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#202936] text-white">
              <Moon size={21} fill="white" strokeWidth={1.7} />
            </span>
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
                  : "本地演示模式"}
              </div>
            </div>
          )}
          <div className="mt-4 px-2 text-[11px] text-[#a8b3bf]">
            {!collapsed ? "MOONCLEAN OS · 工作台" : "OS"}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-2 border-b border-[#e9edf2] bg-white/90 px-5 py-2 backdrop-blur-xl md:px-9">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight text-[#202936] md:hidden"><span className="grid size-8 place-items-center rounded-[11px] bg-[#202936] text-white"><Moon size={17} fill="white"/></span>MoonClean <span className="text-[#287fe2]">OS</span></Link>
          <div className="hidden items-center gap-2 text-xs text-[#92a0ae] md:flex">
            <span>工作空间</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#45617d]">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {mode === "cloud" && stores.length > 0 && (
              <select
                aria-label="切换店铺"
                className="max-w-[130px] rounded-xl border border-[#e4e9ef] bg-[#f8fafb] px-2.5 py-2 text-xs font-medium text-[#39485a] sm:max-w-[210px]"
                value={activeStoreId || ""}
                onChange={(e) => void switchStore(e.target.value).catch(() => {})}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              error && mode === "cloud"
                ? "bg-[#fff0f1] text-[#e85d65]"
                : "bg-[#e9f7f3] text-[#16a085]",
            )}>
              ● {mode === "local" ? "本地演示" : error ? "云端异常" : saving ? "保存中…" : "云端数据"}
            </span>
            {mode === "cloud" && (
              <>
                <Link
                  href="/account"
                  title="账号设置"
                  className="grid size-9 place-items-center rounded-full bg-[#edf3fb] text-[#287fe2]"
                >
                  <CircleUserRound size={18} />
                </Link>
                <button
                  aria-label="退出登录"
                  title="退出登录"
                  disabled={logoutBusy}
                  onClick={signOut}
                  className="text-[#8fa1b3] hover:text-[#e85d65]"
                >
                  <LogOut size={17} />
                </button>
              </>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1530px] px-5 pb-28 pt-7 md:px-9 md:pb-12 md:pt-10">
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
            <p role="status" className="mb-4 text-xs text-[#3b91eb]">
              正在保存到云端…
            </p>
          )}
          {loading ? (
            <p className="py-20 text-center text-sm text-[#8fa1b3]">
              正在加载店铺数据…
            </p>
          ) : mode === "cloud" && !activeStoreId && !error ? (
            <StoreOnboarding />
          ) : error && !data ? null : (
            children
          )}
        </main>
      </div>
      <nav aria-label="主导航" className="fixed inset-x-3 bottom-[max(8px,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] border border-white/80 bg-white/75 px-2 pb-2 pt-2 shadow-[0_8px_32px_rgba(31,57,82,0.14),0_1px_3px_rgba(31,57,82,0.06)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/65 md:hidden">
        {nav.filter(item => mobilePrimary.includes(item.href)).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium",
              pathname === href ? "text-[#287fe2]" : "text-[#8794a2]",
            )}
          >
            <Icon size={20} strokeWidth={pathname === href ? 2.3 : 1.8} />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <button type="button" aria-label="更多功能" onClick={() => setMobileMenuOpen(true)} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium", mobilePrimary.includes(pathname) ? "text-[#8794a2]" : "text-[#287fe2]")}>
          <Menu size={20}/><span>更多</span>
        </button>
      </nav>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] overflow-y-auto rounded-t-[30px] border-[#e5edf5] bg-white/95 p-5 pb-[max(22px,env(safe-area-inset-bottom))] shadow-[0_-16px_50px_rgba(31,57,82,0.16)] backdrop-blur-2xl md:hidden">
          <SheetHeader className="px-1 pb-4 text-left">
            <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#eaf4ff] text-[#3189e8]"><Sparkles size={21}/></div>
            <SheetTitle className="text-xl">更多功能</SheetTitle>
            <p className="text-sm text-[#8192a3]">常用经营工具与系统管理</p>
          </SheetHeader>
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
    </div>
  );
}
