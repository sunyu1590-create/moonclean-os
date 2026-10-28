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
import { hasLocalData, parseAppData, repository } from "@/lib/repository";
import { createEmptyLocalData } from "@/lib/seed";
import { setDisplayCurrency } from "@/lib/finance";
import { notifyFeedback } from "@/lib/feedback";
import { getBrowserDeviceId } from "@/lib/browser-device-id";
import { isCacheEnabled } from "@/lib/cache-preferences";
import { appendLocalBusinessRevisions, ensureLocalBusinessBaselines } from "@/lib/business-history";
import { clearBrowserSessionPolicy, createBrowserSupabaseClient, getBrowserSessionPolicyExpiry } from "@/lib/supabase/browser";
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
  dataTransition: DataTransition | null;
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
type DataMode = "local" | "cloud";
type TransitionStep = { label: string; status: "pending" | "active" | "done" };
type DataTransition =
  | { kind: "opening"; mode: DataMode; steps: TransitionStep[] }
  | { kind: "switching"; from: DataMode; to: DataMode; steps: TransitionStep[] };
const transitionLabels = (mode: DataMode, opening = false) => {
  if (opening) return mode === "local"
    ? ["识别本机数据模式", "读取本机保存的数据", "校验数据结构与版本", "准备经营分析界面"]
    : ["验证登录与数据权限", "获取当前账号的店铺", "读取经营数据与商品成本", "准备图表和经营页面"];
  return mode === "local"
    ? ["检查未完成的数据保存", "读取本机工作区", "校验业务数据与版本", "切换至本机工作区"]
    : ["检查 Supabase 登录状态", "读取可访问的云端店铺", "加载经营数据和成本版本", "切换至云端工作区"];
};
const makeTransition = (kind: "opening" | "switching", mode: DataMode, from?: DataMode): DataTransition => ({
  ...(kind === "opening" ? { kind, mode } : { kind, from: from || "local", to: mode }),
  steps: transitionLabels(mode, kind === "opening").map((label, index) => ({ label, status: index === 0 ? "active" : "pending" })),
}) as DataTransition;
const updateTransitionStep = (transition: DataTransition, activeIndex: number): DataTransition => ({
  ...transition,
  steps: transition.steps.map((step, index) => ({ ...step, status: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending" })),
});
const finishTransition = (transition: DataTransition): DataTransition => ({
  ...transition,
  steps: transition.steps.map((step) => ({ ...step, status: "done" })),
});
const Context = createContext<ContextValue | null>(null);
const ACTIVE_KEY = "moonclean-active-store";
const CORE_CACHE_KEY = "moonclean-core-snapshot-v1";
const DATA_MODE_KEY = "moonclean-data-mode-v1";
const DATA_MODE_COOKIE = "moonclean-data-mode";
function dataSwitchTiming() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { minimum: 0, step: 0 };
  const level = document.documentElement.dataset.motion;
  if (level === "refined") return { minimum: 1_050, step: 170 };
  if (level === "simple") return { minimum: 0, step: 0 };
  return { minimum: 480, step: 100 };
}
const waitForTransitionStep = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));
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
function readCoreSnapshot(userId: string, storeId: string): AppData | null {
  if (!isCacheEnabled("startup")) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(`${CORE_CACHE_KEY}:${userId}:${storeId}`) || "null") as { data?: unknown } | null;
    if (!cache?.data) return null;
    return parseAppData(cache.data);
  } catch { return null; }
}
function writeCoreSnapshot(userId: string, storeId: string, data: AppData) {
  if (!isCacheEnabled("startup")) {
    try { localStorage.removeItem(`${CORE_CACHE_KEY}:${userId}:${storeId}`); } catch { /* Continue without a startup snapshot. */ }
    return;
  }
  try { localStorage.setItem(`${CORE_CACHE_KEY}:${userId}:${storeId}`, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* The cloud remains the source of truth if the local cache is unavailable. */ }
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"local" | "cloud">(() => localDemoEnabled() ? "local" : "cloud");
  const [modeReady, setModeReady] = useState(false);
  const [dataTransition, setDataTransition] = useState<ContextValue["dataTransition"]>(makeTransition("opening", localDemoEnabled() ? "local" : "cloud"));
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
      let showOpening = !hasLoadedRef.current;
      if (showOpening) {
        setDataTransition(makeTransition("opening", mode));
      }
      setLoading(true);
      setError(null);
      let openingSucceeded = false;
      let servedFromCache = false;
      try {
        if (mode === "local") {
          if (showOpening) setDataTransition((current) => current ? updateTransitionStep(current, 1) : current);
          const loaded = repository.load();
          if (showOpening) setDataTransition((current) => current ? updateTransitionStep(current, 2) : current);
          setDisplayCurrency(loaded.settings.store.currency);
          dataRef.current = loaded;
          setData(loaded);
          setActiveStoreId(loaded.settings.store.id);
          if (showOpening) setDataTransition((current) => current ? updateTransitionStep(current, 3) : current);
        } else {
          if (!supabaseConfig())
            throw new Error(
              "尚未配置 Supabase，请参照 .env.example 设置项目地址和 Publishable Key",
            );
          if (showOpening) setDataTransition((current) => current ? updateTransitionStep(current, 1) : current);
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
            const cachedSnapshot = readCoreSnapshot(response.user.id, id);
            let cachedDisplayedAt: number | null = null;
            if (cachedSnapshot) {
              servedFromCache = true;
              const currentRole = response.stores.find((store) => store.id === id)?.role;
              const cached = currentRole ? { ...cachedSnapshot, settings: { ...cachedSnapshot.settings, role: currentRole } } : cachedSnapshot;
              dataRef.current = cached;
              setDisplayCurrency(cached.settings.store.currency);
              setData(cached);
              cachedDisplayedAt = performance.now();
              setLoading(false);
              setDataTransition(null);
              hasLoadedRef.current = true;
              loadedModeRef.current = "cloud";
              showOpening = false;
            }
            if (showOpening) setDataTransition((current) => current ? updateTransitionStep(current, 2) : current);
            const loaded = await cloud.load(id);
            if (showOpening) setDataTransition((current) => current ? updateTransitionStep(current, 3) : current);
            setDisplayCurrency(loaded.settings.store.currency);
            dataRef.current = loaded;
            setData(loaded);
            writeCoreSnapshot(response.user.id, id, loaded);
            if (cachedDisplayedAt !== null) {
              const savedSeconds = Math.max(0, (performance.now() - cachedDisplayedAt) / 1000);
              notifyFeedback({
                kind: "success",
                title: "首页已从本机缓存快速显示",
                description: `本机快照先行显示，相当于节省了约 ${savedSeconds.toFixed(1)} 秒首屏等待；后台云端同步已完成。`,
              });
            }
          } else {
            dataRef.current = null;
            setData(null);
          }
        }
        openingSucceeded = true;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "加载失败";
        setError(message);
        if (servedFromCache) notifyFeedback({ kind: "info", title: "已从本机缓存恢复首页", description: "缓存内容已先行显示，云端同步暂不可用；当前仍可查看最近一次保存的数据。" });
        if (!servedFromCache) { dataRef.current = null; setData(null); }
      } finally {
        if (showOpening) {
          if (openingSucceeded) {
            setDataTransition((current) => current ? finishTransition(current) : current);
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (!reduced) await new Promise((resolve) => setTimeout(resolve, 120));
            hasLoadedRef.current = true;
          }
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
    if (mode === "local" && data && activeStoreId) ensureLocalBusinessBaselines(activeStoreId, data);
  }, [mode, data, activeStoreId]);
  useEffect(() => {
    if (mode !== "cloud" || !user?.id || isAuthRoute) return;
    const register = () => {
      const deviceId = getBrowserDeviceId();
      void fetch("/api/account/sessions", {
        cache: "no-store",
        headers: deviceId ? { "x-moonclean-device-id": deviceId } : undefined,
      }).then((response) => {
        if (response.status === 401) window.dispatchEvent(new Event("moonclean-auth-expired"));
      }).catch(() => undefined);
    };
    register();
    const timer = window.setInterval(register, 5 * 60_000);
    window.addEventListener("focus", register);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", register); };
  }, [mode, user?.id, isAuthRoute]);
  useEffect(() => {
    if (mode !== "cloud" || !user?.id || isAuthRoute) return;
    let timer = 0;
    let active = true;
    const expireSessionIfNeeded = () => {
      if (!active) return;
      const expiresAt = getBrowserSessionPolicyExpiry();
      if (expiresAt === null) return;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        void createBrowserSupabaseClient().auth.signOut({ scope: "local" }).finally(() => {
          clearBrowserSessionPolicy();
          window.location.replace("/login?error=session-expired");
        });
        return;
      }
      timer = window.setTimeout(expireSessionIfNeeded, Math.min(remaining, 2_147_000_000));
    };
    expireSessionIfNeeded();
    return () => { active = false; window.clearTimeout(timer); };
  }, [mode, user?.id, isAuthRoute]);
  useEffect(() => {
    if (isAuthRoute) return;
    const handleExpired = () => {
      void createBrowserSupabaseClient().auth.signOut({ scope: "local" }).finally(() => {
        clearBrowserSessionPolicy();
        window.location.replace("/login?error=session-expired");
      });
    };
    window.addEventListener("moonclean-auth-expired", handleExpired);
    return () => window.removeEventListener("moonclean-auth-expired", handleExpired);
  }, [isAuthRoute]);
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
        if (active && user?.id) writeCoreSnapshot(user.id, activeStoreId, fresh);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "云端同步失败");
      }
    };
    const timer = window.setInterval(() => void sync(), 60_000);
    window.addEventListener("focus", sync);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", sync); };
  }, [mode, activeStoreId, isAuthRoute, cloud, user?.id]);
  const switchStore = async (id: string) => {
    if (mode !== "cloud") return;
    if (!stores.some((s) => s.id === id)) throw new Error("无权访问此店铺");
    setLoading(true);
    setError(null);
    try {
      const loaded = await cloud.load(id);
      try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* Remembering this preference is optional. */ }
      if (user?.id) writeCoreSnapshot(user.id, id, loaded);
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
    const timing = dataSwitchTiming();
    let transition = makeTransition("switching", target, mode);
    setDataTransition(transition);
    await waitForTransitionStep(timing.step);
    setLoading(true);
    setError(null);
    try {
      if (target === "local") {
        transition = updateTransitionStep(transition, 1); setDataTransition(transition); await waitForTransitionStep(timing.step);
        const hasSavedLocalData = hasLocalData();
        const loaded = hasSavedLocalData ? repository.load() : createEmptyLocalData();
        transition = updateTransitionStep(transition, 2); setDataTransition(transition); await waitForTransitionStep(timing.step);
        if (!hasSavedLocalData) await repository.save(loaded);
        setMode("local");
        setStores([]);
        setActiveStoreId(loaded.settings.store.id);
        applyData(loaded);
      } else {
        if (!supabaseConfig()) throw new Error("尚未配置 Supabase，暂时无法切换到云端数据。");
        transition = updateTransitionStep(transition, 1); setDataTransition(transition); await waitForTransitionStep(timing.step);
        const response = await listStores();
        let saved: string | null = null;
        try { saved = localStorage.getItem(ACTIVE_KEY); } catch { /* Use the first authorized store. */ }
        const id = response.stores.some((store) => store.id === saved) ? saved : response.stores[0]?.id;
        transition = updateTransitionStep(transition, 2); setDataTransition(transition); await waitForTransitionStep(timing.step);
        const loaded = id ? await cloud.load(id) : null;
        transition = updateTransitionStep(transition, 3); setDataTransition(transition);
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
      setDataTransition((current) => current ? finishTransition(current) : current);
      const remaining = timing.minimum - (Date.now() - startedAt);
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
    notifyFeedback({ kind: "success", title: "店铺创建成功", description: `“${input.name}”已连接到云端。` });
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
        appendLocalBusinessRevisions(current.settings.store.id, current, next);
        setActiveStoreId(next.settings.store.id);
        applyData(next);
      } else {
        await cloud.save(next, current);
        const fresh = await cloud.load(activeStoreId || undefined);
        applyData(fresh);
        if (user?.id && activeStoreId) writeCoreSnapshot(user.id, activeStoreId, fresh);
        setStores(current => current.map(store => store.id === fresh.settings.store.id ? {...store, name:fresh.settings.store.name, platform:fresh.settings.store.platform, currency:fresh.settings.store.currency, timezone:fresh.settings.store.timezone||"Asia/Shanghai"} : store));
      }
      notifyFeedback({ kind: "success", title: "保存成功", description: mode === "cloud" ? "数据已保存并同步到云端。" : "数据已保存到当前设备。" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败";
      setError(message);
      notifyFeedback({ kind: "error", title: "保存失败", description: message });
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
    if (dataRef.current) appendLocalBusinessRevisions(dataRef.current.settings.store.id, dataRef.current, empty);
    await repository.save(empty);
    setActiveStoreId(empty.settings.store.id);
    applyData(empty);
    notifyFeedback({ kind: "success", title: "本地数据已重置", description: "新的空白工作区已准备好。" });
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
