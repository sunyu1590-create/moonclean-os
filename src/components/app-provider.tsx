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
import { hasLocalData, repository } from "@/lib/repository";
import { createEmptyLocalData } from "@/lib/seed";
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
  dataTransition: { kind: "opening" } | { kind: "switching"; from: "local" | "cloud"; to: "local" | "cloud" } | null;
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
  switchDataMode: (mode: "local" | "cloud") => Promise<void>;
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
const DATA_MODE_KEY = "moonclean-data-mode-v1";
const DATA_MODE_COOKIE = "moonclean-data-mode";
const MIN_TRANSITION_MS = 460;
function persistDataMode(target: "local" | "cloud") {
  try { localStorage.setItem(DATA_MODE_KEY, target); } catch { /* Data source still changes for this session. */ }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try { document.cookie = `${DATA_MODE_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`; } catch { /* Keep this session usable if cookies are blocked. */ }
}
function readPersistedDataMode(): "local" | "cloud" | null {
  let saved: string | null = null;
  try { saved = localStorage.getItem(DATA_MODE_KEY); } catch { /* Cookie is a fallback. */ }
  if (saved === "local" || saved === "cloud") return saved;
  try {
    const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${DATA_MODE_COOKIE}=`));
    const value = cookie?.slice(DATA_MODE_COOKIE.length + 1);
    return value === "local" || value === "cloud" ? value : null;
  } catch { return null; }
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"local" | "cloud">(() => localDemoEnabled() ? "local" : "cloud");
  const [modeReady, setModeReady] = useState(false);
  const [dataTransition, setDataTransition] = useState<ContextValue["dataTransition"]>({kind:"opening"});
  const hasLoadedRef = useRef(false);
  const loadedModeRef = useRef<"local" | "cloud" | null>(null);
  const modeSwitchRef = useRef(false);
  const modeRef = useRef(mode);
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
      const showOpening = !hasLoadedRef.current;
      const startedAt = Date.now();
      if (showOpening) setDataTransition({kind:"opening"});
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
          let browserPreferred: string | null = null;
          try { browserPreferred = localStorage.getItem(ACTIVE_KEY); } catch { /* Store selection is optional. */ }
          const saved = preferred || browserPreferred;
          const id = response.stores.some((s) => s.id === saved)
            ? saved
            : response.stores[0]?.id;
          setActiveStoreId(id || null);
          if (id) {
            try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* Keep the current session usable if storage is blocked. */ }
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
        if (showOpening) {
          const remaining = MIN_TRANSITION_MS - (Date.now() - startedAt);
          if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
          hasLoadedRef.current = true;
          setDataTransition(null);
        }
        setLoading(false);
      }
    },
    [mode, cloud],
  );
  useEffect(() => {
    if (isAuthRoute) return;
    const frame = window.requestAnimationFrame(() => {
      const saved = readPersistedDataMode();
      if (saved) { modeRef.current = saved; setMode(saved); persistDataMode(saved); }
      setModeReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isAuthRoute]);
  useEffect(() => {
    if (!modeReady || isAuthRoute) return;
    if (hasLoadedRef.current && loadedModeRef.current === mode) return;
    loadedModeRef.current = mode;
    queueMicrotask(() => void refresh());
  }, [isAuthRoute, modeReady, mode, refresh]);
  useEffect(() => {
    if (mode !== "cloud" || !activeStoreId || isAuthRoute) return;
    let active = true;
    const sync = async () => {
      if (busyRef.current || document.visibilityState === "hidden") return;
      if (modeSwitchRef.current || modeRef.current !== "cloud") return;
      try {
        const fresh = await cloud.load(activeStoreId);
        if (active && !modeSwitchRef.current && modeRef.current === "cloud" && JSON.stringify(fresh) !== JSON.stringify(dataRef.current)) {
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
      try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* Remembering this preference is optional. */ }
      setActiveStoreId(id);
      applyData(loaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "切换失败");
      throw cause;
    } finally {
      setLoading(false);
    }
  };
  const switchDataMode = async (target: "local" | "cloud") => {
    if (target === mode) return;
    if (busyRef.current || modeSwitchRef.current) throw new Error("当前有数据操作正在进行，请稍后再切换。");
    modeSwitchRef.current = true;
    const previousMode = mode;
    modeRef.current = target;
    const startedAt = Date.now();
    setDataTransition({kind:"switching",from:mode,to:target});
    setLoading(true);
    setError(null);
    try {
      if (target === "local") {
        const hasSavedLocalData = hasLocalData();
        const loaded = hasSavedLocalData ? repository.load() : createEmptyLocalData();
        if (!hasSavedLocalData) await repository.save(loaded);
        setMode("local");
        setStores([]);
        setActiveStoreId(loaded.settings.store.id);
        applyData(loaded);
      } else {
        if (!supabaseConfig()) throw new Error("尚未配置 Supabase，暂时无法切换到云端数据。");
        const response = await listStores();
        let saved: string | null = null;
        try { saved = localStorage.getItem(ACTIVE_KEY); } catch { /* Use the first authorized store. */ }
        const id = response.stores.some((store) => store.id === saved) ? saved : response.stores[0]?.id;
        const loaded = id ? await cloud.load(id) : null;
        setStores(response.stores);
        setUser(response.user);
        setActiveStoreId(id || null);
        applyData(loaded);
        setMode("cloud");
        if (id) try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* The cloud session remains usable for this visit. */ }
      }
      persistDataMode(target);
      hasLoadedRef.current = true;
      loadedModeRef.current = target;
      setDisplayCurrency(dataRef.current?.settings.store.currency || "CNY");
    } catch (cause) {
      modeRef.current = previousMode;
      const message = cause instanceof Error ? cause.message : "切换数据源失败，请稍后重试。";
      setError(message);
      throw new Error(message);
    } finally {
      const remaining = MIN_TRANSITION_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setDataTransition(null);
      setLoading(false);
      modeSwitchRef.current = false;
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
    const empty = createEmptyLocalData();
    await repository.save(empty);
    setActiveStoreId(empty.settings.store.id);
    applyData(empty);
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
        dataTransition,
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
        switchDataMode,
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
