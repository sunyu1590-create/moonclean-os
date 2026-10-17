"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { AppData, StoreRole } from "@/lib/model";
import { repository } from "@/lib/repository";
import { setDisplayCurrency } from "@/lib/finance";
import { localDemoEnabled, supabaseConfig } from "@/lib/supabase/config";
import {
  SupabaseRepository,
  createCloudStore,
  listStores,
  type StoreChoice,
} from "@/lib/supabase/repository";

interface ContextValue {
  data: AppData | null;
  mode: "local" | "cloud";
  loading: boolean;
  saving: boolean;
  error: string | null;
  stores: StoreChoice[];
  activeStoreId: string | null;
  role: StoreRole | null;
  user: { id: string; email: string } | null;
  update: (fn: (current: AppData) => AppData) => Promise<void>;
  reset: () => Promise<void>;
  retry: () => Promise<void>;
  switchStore: (id: string) => Promise<void>;
  createStore: (input: {
    name: string;
    platform: string;
    currency: string;
    timezone: string;
  }) => Promise<void>;
  exportBackup: () => string;
}
const Context = createContext<ContextValue | null>(null);
const ACTIVE_KEY = "moonclean-active-store";
export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = localDemoEnabled() ? ("local" as const) : ("cloud" as const);
  const [cloud] = useState(() => new SupabaseRepository());
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const [stores, setStores] = useState<StoreChoice[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const isAuthRoute = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);
  const applyData = (next: AppData | null) => {
    dataRef.current = next;
    if (next) setDisplayCurrency(next.settings.store.currency);
    setData(next);
  };
  const refresh = useCallback(
    async (preferred?: string) => {
      setLoading(true);
      setError(null);
      try {
        if (mode === "local") {
          const loaded = repository.load();
          setDisplayCurrency(loaded.settings.store.currency);
          dataRef.current = loaded;
          setData(loaded);
          setActiveStoreId(loaded.settings.store.id);
        } else {
          if (!supabaseConfig())
            throw new Error(
              "尚未配置 Supabase，请参照 .env.example 设置项目地址和 Publishable Key",
            );
          const response = await listStores();
          setStores(response.stores);
          setUser(response.user);
          const saved = preferred || localStorage.getItem(ACTIVE_KEY);
          const id = response.stores.some((s) => s.id === saved)
            ? saved
            : response.stores[0]?.id;
          setActiveStoreId(id || null);
          if (id) {
            localStorage.setItem(ACTIVE_KEY, id);
            const loaded = await cloud.load(id);
            setDisplayCurrency(loaded.settings.store.currency);
            dataRef.current = loaded;
            setData(loaded);
          } else {
            dataRef.current = null;
            setData(null);
          }
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "加载失败");
        dataRef.current = null;
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [mode, cloud],
  );
  useEffect(() => {
    if (isAuthRoute) return;
    queueMicrotask(() => void refresh());
  }, [isAuthRoute, refresh]);
  useEffect(() => {
    if (mode !== "cloud" || !activeStoreId || isAuthRoute) return;
    let active = true;
    const sync = async () => {
      if (busyRef.current || document.visibilityState === "hidden") return;
      try {
        const fresh = await cloud.load(activeStoreId);
        if (active && JSON.stringify(fresh) !== JSON.stringify(dataRef.current)) {
          dataRef.current = fresh;
          setDisplayCurrency(fresh.settings.store.currency);
          setData(fresh);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "云端同步失败");
      }
    };
    const timer = window.setInterval(() => void sync(), 60_000);
    window.addEventListener("focus", sync);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", sync); };
  }, [mode, activeStoreId, isAuthRoute, cloud]);
  const switchStore = async (id: string) => {
    if (mode !== "cloud") return;
    if (!stores.some((s) => s.id === id)) throw new Error("无权访问此店铺");
    setLoading(true);
    setError(null);
    try {
      const loaded = await cloud.load(id);
      localStorage.setItem(ACTIVE_KEY, id);
      setActiveStoreId(id);
      applyData(loaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "切换失败");
      throw cause;
    } finally {
      setLoading(false);
    }
  };
  const createStore = async (input: {
    name: string;
    platform: string;
    currency: string;
    timezone: string;
  }) => {
    if (mode !== "cloud") throw new Error("本地演示模式无法创建云端店铺");
    const result = await createCloudStore(input);
    await refresh(result.id);
  };
  const update = async (fn: (current: AppData) => AppData) => {
    if (busyRef.current) throw new Error("上一次操作尚未完成");
    const current = dataRef.current;
    if (!current) throw new Error("数据尚未加载");
    busyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const next = fn(current);
      if (mode === "local") {
        repository.save(next);
        applyData(next);
      } else {
        await cloud.save(next, current);
        const fresh = await cloud.load(activeStoreId || undefined);
        applyData(fresh);
        setStores(current => current.map(store => store.id === fresh.settings.store.id ? {...store, name:fresh.settings.store.name, platform:fresh.settings.store.platform, currency:fresh.settings.store.currency, timezone:fresh.settings.store.timezone||"Asia/Shanghai"} : store));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败";
      setError(message);
      if (mode === "cloud" && activeStoreId) {
        try {
          applyData(await cloud.load(activeStoreId));
        } catch {}
      }
      throw new Error(message);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };
  const reset = async () => {
    if (mode !== "local") throw new Error("云端数据不能重置为模拟数据");
    applyData(repository.reset());
  };
  const exportBackup = () => {
    if (!dataRef.current) throw new Error("数据尚未加载");
    return JSON.stringify(dataRef.current, null, 2);
  };
  return (
    <Context.Provider
      value={{
        data,
        mode,
        loading,
        saving,
        error,
        stores,
        activeStoreId,
        role: data?.settings.role || null,
        user,
        update,
        reset,
        retry: () => refresh(),
        switchStore,
        createStore,
        exportBackup,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider missing");
  return value;
}
