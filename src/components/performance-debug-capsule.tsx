"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Activity, Copy, MemoryStick, Network, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERFORMANCE_DEBUG_EVENT, PERFORMANCE_DEBUG_METRICS_EVENT, readPerformanceDebugEnabled, readPerformanceDebugMetrics, type DebugMetricId } from "@/lib/debug-preferences";
import { APP_VERSION } from "@/lib/release-notes";
import type { MotionLevel } from "@/components/motion-preferences";

type DebugMetrics = {
  fps: number | null;
  frameMs: number | null;
  heapUsed: number | null;
  heapLimit: number | null;
  viewport: string;
  dpr: number;
  deviceMemory: number | null;
  cores: number | null;
  displayHz: number | null;
  online: boolean;
  network: string;
  longTasks: number | null;
  firstPaint: number | null;
};
type NavigatorConnection = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
type ExtendedNavigator = Navigator & { deviceMemory?: number; hardwareConcurrency?: number; connection?: NavigatorConnection };
type ExtendedPerformance = Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
const emptyMetrics: DebugMetrics = {
  fps: null, frameMs: null, heapUsed: null, heapLimit: null, viewport: "—", dpr: 1,
  deviceMemory: null, cores: null, displayHz: null, online: true, network: "不可用", longTasks: null, firstPaint: null,
};
const motionLabels: Record<MotionLevel, string> = { refined: "Max", standard: "Standard", simple: "Low" };
const formatBytes = (bytes: number | null) => bytes === null ? "浏览器未开放" : `${(bytes / 1024 / 1024).toFixed(0)} MB`;

export function PerformanceDebugCapsule({ motionLevel, dataMode }: { motionLevel: MotionLevel; dataMode: "local" | "cloud" }) {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [metrics, setMetrics] = useState<DebugMetrics>(emptyMetrics);
  const [visibleMetrics, setVisibleMetrics] = useState<DebugMetricId[]>([]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const next = typeof detail === "boolean" ? detail : readPerformanceDebugEnabled();
      setEnabled(next);
      if (!next) setExpanded(false);
    };
    const updateMetrics = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setVisibleMetrics(Array.isArray(detail) ? detail as DebugMetricId[] : readPerformanceDebugMetrics());
    };
    const frame = window.requestAnimationFrame(() => setEnabled(readPerformanceDebugEnabled()));
    const metricsFrame = window.requestAnimationFrame(() => setVisibleMetrics(readPerformanceDebugMetrics()));
    window.addEventListener("storage", update);
    window.addEventListener(PERFORMANCE_DEBUG_EVENT, update);
    window.addEventListener(PERFORMANCE_DEBUG_METRICS_EVENT, updateMetrics);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(metricsFrame);
      window.removeEventListener("storage", update);
      window.removeEventListener(PERFORMANCE_DEBUG_EVENT, update);
      window.removeEventListener(PERFORMANCE_DEBUG_METRICS_EVENT, updateMetrics);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let frameId = 0;
    let frameCount = 0;
    let sampleStart = 0;
    let longTaskCount = 0;
    let observer: PerformanceObserver | undefined;
    const updateStatic = () => {
      const extended = navigator as ExtendedNavigator;
      const connection = extended.connection;
      const networkParts = [connection?.effectiveType, connection?.downlink ? `${connection.downlink} Mbps` : null, connection?.rtt ? `${connection.rtt} ms` : null].filter(Boolean);
      const paints = performance.getEntriesByName("first-contentful-paint");
      setMetrics((current) => ({
        ...current,
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
        dpr: window.devicePixelRatio || 1,
        deviceMemory: typeof extended.deviceMemory === "number" ? extended.deviceMemory : null,
        cores: typeof extended.hardwareConcurrency === "number" ? extended.hardwareConcurrency : null,
        displayHz: typeof (screen as Screen & { refreshRate?: number }).refreshRate === "number" ? (screen as Screen & { refreshRate: number }).refreshRate : null,
        online: navigator.onLine,
        network: networkParts.length ? networkParts.join(" · ") : "浏览器未开放",
        longTasks: typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask") ? longTaskCount : null,
        firstPaint: paints.length ? paints[0].startTime : null,
      }));
    };
    const extendedPerformance = performance as ExtendedPerformance;
    const collect = (timestamp: number) => {
      if (sampleStart === 0) sampleStart = timestamp;
      frameCount += 1;
      if (timestamp - sampleStart >= 1000) {
        const duration = timestamp - sampleStart;
        const fps = Math.round(frameCount * 1000 / duration);
        setMetrics((current) => ({
          ...current,
          fps,
          frameMs: fps > 0 ? 1000 / fps : null,
          heapUsed: typeof extendedPerformance.memory?.usedJSHeapSize === "number" ? extendedPerformance.memory.usedJSHeapSize : null,
          heapLimit: typeof extendedPerformance.memory?.jsHeapSizeLimit === "number" ? extendedPerformance.memory.jsHeapSizeLimit : null,
        }));
        frameCount = 0;
        sampleStart = timestamp;
        updateStatic();
      }
      frameId = requestAnimationFrame(collect);
    };
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      observer = new PerformanceObserver((list) => { longTaskCount += list.getEntries().length; });
      observer.observe({ type: "longtask", buffered: true });
    }
    updateStatic();
    window.addEventListener("resize", updateStatic);
    window.addEventListener("online", updateStatic);
    window.addEventListener("offline", updateStatic);
    frameId = requestAnimationFrame(collect);
    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", updateStatic);
      window.removeEventListener("online", updateStatic);
      window.removeEventListener("offline", updateStatic);
    };
  }, [enabled]);

  if (!enabled) return null;
  async function copyDiagnostics() {
    setCopied(false);
    setCopyError("");
    try {
      await navigator.clipboard.writeText(JSON.stringify({ appVersion: APP_VERSION, motion: motionLabels[motionLevel], dataMode, capturedAt: new Date().toISOString(), ...metrics }, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("剪贴板不可用，请检查浏览器权限。");
    }
  }
  const heapPercent = metrics.heapUsed !== null && metrics.heapLimit ? Math.min(100, Math.round(metrics.heapUsed / metrics.heapLimit * 100)) : null;
  const show = (id: DebugMetricId) => visibleMetrics.includes(id);

  return <div className="performance-debug-root" aria-live="off">
    <button type="button" className="performance-debug-pill" aria-expanded={expanded} aria-label="网页性能调试信息" onClick={() => setExpanded((value) => !value)}>
      <span className={`performance-debug-dot ${metrics.fps !== null && metrics.fps < 40 ? "is-slow" : ""}`}/>
      <Activity size={14}/><span>{!show("fps") ? "运行诊断" : metrics.fps === null ? "帧率 …" : `帧率 ${metrics.fps}`}</span>
    </button>
    {expanded && <section className="performance-debug-panel" aria-label="性能调试面板">
      <header><span><strong>运行状态</strong><small>实时估算 · v{APP_VERSION}</small></span><button type="button" aria-label="关闭调试面板" onClick={() => setExpanded(false)}><X size={16}/></button></header>
      <div className="performance-debug-grid">
        {show("fps") && <DebugMetric label="页面帧率" value={metrics.fps === null ? "采集中…" : `约 ${metrics.fps} FPS`} detail={metrics.frameMs === null ? "等待采样" : `单帧 ${metrics.frameMs.toFixed(1)} ms`} icon={<Activity size={15}/>} />}
        {show("heap") && <DebugMetric label="JS 堆内存" value={formatBytes(metrics.heapUsed)} detail={heapPercent === null ? "Chromium 专有 API，其他浏览器不开放" : `占堆上限 ${heapPercent}%`} icon={<MemoryStick size={15}/>} />}
        {show("viewport") && <DebugMetric label="设备与视口" value={metrics.viewport} detail={`DPR ${metrics.dpr} · ${metrics.cores === null ? "CPU 核数不可用" : `${metrics.cores} 个逻辑核`}${metrics.deviceMemory === null ? "" : ` · 设备内存约 ${metrics.deviceMemory} GB`}`} icon={<Smartphone size={15}/>} />}
        {show("refresh") && <DebugMetric label="屏幕刷新率" value={metrics.displayHz === null ? "浏览器未开放" : `${metrics.displayHz} Hz`} detail={metrics.fps === null ? "页面 FPS 正在采样" : `页面当前约 ${metrics.fps} FPS`} icon={<Activity size={15}/>} />}
        {show("network") && <DebugMetric label="网络连接" value={metrics.online ? "在线" : "离线"} detail={metrics.network} icon={<Network size={15}/>} />}
        {show("longtasks") && <DebugMetric label="长任务监测" value={metrics.longTasks === null ? "浏览器未开放" : `${metrics.longTasks} 次`} detail={metrics.firstPaint === null ? "FCP 暂不可用" : `首次内容绘制 ${Math.round(metrics.firstPaint)} ms`} icon={<Activity size={15}/>} />}
        {show("workspace") && <DebugMetric label="当前工作区" value={dataMode === "cloud" ? "云端数据" : "本地数据"} detail={`动效：${motionLabels[motionLevel]}`} icon={<Network size={15}/>} />}
      </div>
      {visibleMetrics.length === 0 && <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs text-muted-foreground">尚未选择指标。请前往系统设置，自定义要显示的诊断信息。</p>}
      <p className="performance-debug-note">FPS 与帧耗时由页面动画帧估算；硬件内存和真实屏幕刷新率受浏览器权限限制，不可用时会如实标注。</p>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void copyDiagnostics()}><Copy size={14}/>{copied ? "已复制诊断信息" : "复制诊断信息"}</Button>
      {copyError && <p role="alert" className="mt-2 text-xs text-[var(--mc-color-danger)]">{copyError}</p>}
    </section>}
  </div>;
}

function DebugMetric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="performance-debug-metric"><span className="performance-debug-metric-icon">{icon}</span><span className="min-w-0"><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>;
}
