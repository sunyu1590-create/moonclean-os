"use client";

import { useCallback } from "react";
import { useReportWebVitals } from "next/web-vitals";

export const WEB_VITALS_EVENT = "moonclean:web-vitals";
const WEB_VITALS_SESSION_KEY = "moonclean-web-vitals-v1";
export type WebVitalName = "LCP" | "INP" | "CLS" | "TTFB";
export type WebVitalSample = { value: number; rating: string };

declare global {
  interface Window {
    __mooncleanWebVitals?: Partial<Record<WebVitalName, WebVitalSample>>;
  }
}

export function WebVitalsMonitor() {
  const report = useCallback((metric: { name: string; value: number; rating: string }) => {
    if (metric.name !== "LCP" && metric.name !== "INP" && metric.name !== "CLS" && metric.name !== "TTFB") return;
    const sample = { value: metric.value, rating: metric.rating };
    window.__mooncleanWebVitals = { ...window.__mooncleanWebVitals, [metric.name]: sample };
    try { sessionStorage.setItem(WEB_VITALS_SESSION_KEY, JSON.stringify(window.__mooncleanWebVitals)); } catch { /* Keep in-memory diagnostics available when storage is blocked. */ }
    window.dispatchEvent(new CustomEvent(WEB_VITALS_EVENT, { detail: { name: metric.name, ...sample } }));
  }, []);

  useReportWebVitals(report);
  return null;
}

export function readWebVitals(): Partial<Record<WebVitalName, WebVitalSample>> {
  if (typeof window === "undefined") return {};
  if (window.__mooncleanWebVitals) return window.__mooncleanWebVitals;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(WEB_VITALS_SESSION_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Partial<Record<WebVitalName, WebVitalSample>> = {};
    for (const name of ["LCP", "INP", "CLS", "TTFB"] as const) {
      const value = (parsed as Record<string, unknown>)[name];
      if (value && typeof value === "object" && "value" in value && "rating" in value && typeof value.value === "number" && typeof value.rating === "string") {
        result[name] = { value: value.value, rating: value.rating };
      }
    }
    return result;
  } catch { return {}; }
}
