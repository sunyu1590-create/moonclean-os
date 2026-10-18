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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "./app-provider";
const nav = [
  { href: "/dashboard", label: "经营总览", icon: LayoutDashboard },
  { href: "/advertising", label: "推广分析", icon: Megaphone },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/finance", label: "财务利润", icon: Wallet },
  { href: "/data", label: "数据中心", icon: Database },
  { href: "/settings", label: "系统设置", icon: Settings },
];
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
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
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
  return (
    <div className="min-h-screen md:flex">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#e5eef6] bg-white/85 backdrop-blur-xl transition-all md:flex",
          collapsed ? "w-[82px]" : "w-[248px]",
        )}
      >
        <div className="flex h-[88px] items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#3b91eb] text-white shadow-[0_7px_17px_#3b91eb44]">
              <Moon size={21} fill="white" />
            </span>
            {!collapsed && (
              <span className="whitespace-nowrap text-[17px] font-bold tracking-tight">
                MoonClean <span className="text-[#3b91eb]">OS</span>
              </span>
            )}
          </Link>
          <button
            aria-label="切换侧边栏"
            className="text-[#9aabba] hover:text-[#3b91eb]"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="px-4 pt-6">
          <p
            className={cn(
              "mb-3 px-3 text-[11px] font-semibold tracking-[.18em] text-[#a2b1c1]",
              collapsed && "sr-only",
            )}
          >
            工作空间
          </p>
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-[#e8f5ff] text-[#2885df]"
                    : "text-[#72859b] hover:bg-[#f4f9fd] hover:text-[#172b45]",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={19} strokeWidth={pathname === href ? 2.3 : 1.8} />
                {!collapsed && label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          {!collapsed && (
            <div className="rounded-2xl border border-[#e8eff7] bg-[#f8fbfe] p-4">
              <div className="mb-1 truncate text-xs font-semibold text-[#172b45]">
                {data?.settings.store.name || "当前店铺"}
              </div>
              <div className="text-xs text-[#8fa1b3]">
                {mode === "cloud"
                  ? `云端数据 · ${role ? roleLabels[role] : ""}`
                  : "本地演示模式"}
              </div>
            </div>
          )}
          <div className="mt-4 px-2 text-[11px] text-[#a8b8c8]">
            {!collapsed ? "MOONCLEAN OS · PHASE 02" : "02"}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[68px] flex-wrap items-center justify-between gap-2 border-b border-[#e9f0f6] bg-[#f7fbff]/90 px-5 py-2 backdrop-blur-xl md:px-9">
          <div className="flex items-center gap-2 text-xs text-[#92a4b7]">
            <span>工作空间</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#45617d]">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {mode === "cloud" && stores.length > 0 && (
              <select
                aria-label="切换店铺"
                className="max-w-[145px] rounded-lg border border-[#dfeaf4] bg-white px-2 py-1.5 text-xs text-[#36536e] sm:max-w-[210px]"
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
                  className="grid size-8 place-items-center rounded-full bg-[#d7eaff] text-[#3b91eb]"
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
        <main className="mx-auto max-w-[1530px] px-5 pb-28 pt-7 md:px-9 md:pb-12 md:pt-9">
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
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-[#e5eef6] bg-white/95 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_22px_#dae9f355] backdrop-blur-xl md:hidden">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg py-1 text-[10px]",
              pathname === href ? "text-[#3b91eb]" : "text-[#8a9eb0]",
            )}
          >
            <Icon size={20} strokeWidth={pathname === href ? 2.3 : 1.8} />
            <span className="truncate">{label.slice(0, 2)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
