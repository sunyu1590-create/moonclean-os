export const PERFORMANCE_DEBUG_KEY = "moonclean-performance-debug-v1";
export const PERFORMANCE_DEBUG_EVENT = "moonclean-performance-debug-change";

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
