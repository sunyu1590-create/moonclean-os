export const PERFORMANCE_DEBUG_KEY = "moonclean-performance-debug-v1";
export const PERFORMANCE_DEBUG_EVENT = "moonclean-performance-debug-change";
export const PERFORMANCE_DEBUG_METRICS_KEY = "moonclean-performance-debug-metrics-v1";
export const PERFORMANCE_DEBUG_METRICS_EVENT = "moonclean-performance-debug-metrics-change";
export const DEBUG_METRICS = [
  { id: "fps", label: "页面帧率与帧耗时" },
  { id: "heap", label: "JS 堆内存" },
  { id: "viewport", label: "设备视口与 DPR" },
  { id: "refresh", label: "屏幕刷新率" },
  { id: "network", label: "网络连接" },
  { id: "longtasks", label: "长任务与首次绘制" },
  { id: "workspace", label: "工作区与动效档位" },
] as const;
export type DebugMetricId = (typeof DEBUG_METRICS)[number]["id"];
export const DEFAULT_DEBUG_METRICS: DebugMetricId[] = DEBUG_METRICS.map(({ id }) => id);

export function readPerformanceDebugEnabled(): boolean {
  try {
    return window.localStorage.getItem(PERFORMANCE_DEBUG_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPerformanceDebugEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(PERFORMANCE_DEBUG_KEY, String(enabled));
  } catch {
    // The current page still adopts the preference when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(PERFORMANCE_DEBUG_EVENT, { detail: enabled }));
}

export function readPerformanceDebugMetrics(): DebugMetricId[] {
  try {
    const stored = window.localStorage.getItem(PERFORMANCE_DEBUG_METRICS_KEY);
    if (stored === null) return DEFAULT_DEBUG_METRICS;
    const saved: unknown = JSON.parse(stored);
    if (Array.isArray(saved)) {
      const valid = saved.filter((item): item is DebugMetricId => DEBUG_METRICS.some((metric) => metric.id === item));
      return valid;
    }
  } catch { /* Use the complete diagnostic set when no preference is saved. */ }
  return DEFAULT_DEBUG_METRICS;
}

export function setPerformanceDebugMetrics(metrics: DebugMetricId[]): void {
  const unique = [...new Set(metrics)].filter((item) => DEBUG_METRICS.some((metric) => metric.id === item));
  try { window.localStorage.setItem(PERFORMANCE_DEBUG_METRICS_KEY, JSON.stringify(unique)); } catch { /* Preference remains active until this page closes. */ }
  window.dispatchEvent(new CustomEvent(PERFORMANCE_DEBUG_METRICS_EVENT, { detail: unique }));
}
