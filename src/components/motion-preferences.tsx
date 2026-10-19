"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Sparkles, Zap } from "lucide-react";
import { APP_VERSION } from "@/lib/release-notes";

export type MotionLevel = "refined" | "standard" | "simple";
export const MOTION_LEVELS: { id: MotionLevel; label: string; short: string; detail: string; experience: string }[] = [
  { id: "refined", label: "精致", short: "丰富动效", detail: "流动柔光、页面景深与细腻交互反馈。", experience: "丰富细腻" },
  { id: "standard", label: "标准", short: "适中动效", detail: "清晰短促的过渡和基础交互反馈。", experience: "轻盈克制" },
  { id: "simple", label: "简单", short: "关闭动效", detail: "直接显示内容，关闭装饰性过渡。", experience: "清爽直接" },
];

type MotionTransition = { id: number; to: MotionLevel };
type MotionContextValue = { level: MotionLevel; ready: boolean; reducedMotion: boolean; setLevel: (level: MotionLevel) => void };
const STORAGE_KEY = "moonclean-motion-level-v1";
const MotionContext = createContext<MotionContextValue | null>(null);

export function useMotionPreferences() {
  const value = useContext(MotionContext);
  if (!value) throw new Error("useMotionPreferences 必须在 MotionPreferencesProvider 中使用");
  return value;
}

function MotionSwitchScreen({ transition }: { transition: MotionTransition }) {
  const target = MOTION_LEVELS.find(item => item.id === transition.to)!;
  const Icon = transition.to === "simple" ? Check : transition.to === "standard" ? Zap : Sparkles;
  return <div className={`motion-switch-screen motion-switch-${transition.to}`} role="status" aria-live="polite" aria-label={`正在切换到${target.label}动效`}>
    <div className="motion-switch-panel">
      <span className="motion-switch-icon"><Icon size={22}/></span>
      <p className="motion-switch-kicker">MOONCLEAN OS · v{APP_VERSION}</p>
      <h2>切换到{target.label}模式</h2>
      <p className="motion-switch-description">{target.detail}</p>
      <div className="motion-switch-progress"><span/></div>
    </div>
  </div>;
}

export function MotionPreferencesProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<MotionLevel>("standard");
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [transition, setTransition] = useState<MotionTransition | null>(null);
  const transitionId = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "refined" || saved === "standard" || saved === "simple") setLevelState(saved);
      } catch { /* Keep the default for private browsing modes that block storage. */ }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = level;
  }, [level]);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const setLevel = useCallback((next: MotionLevel) => {
    if (next === level) return;
    const id = ++transitionId.current;
    if (timer.current !== null) window.clearTimeout(timer.current);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* This session still adopts the selected profile. */ }
    document.documentElement.dataset.motion = next;
    setLevelState(next);
    if (reducedMotion || next === "simple") {
      setTransition(null);
      return;
    }
    setTransition({ id, to: next });
    timer.current = window.setTimeout(() => setTransition(current => current?.id === id ? null : current), next === "standard" ? 320 : 700);
  }, [level, reducedMotion]);

  return <MotionContext.Provider value={{ level, ready, reducedMotion, setLevel }}>
    {children}
    {transition && <MotionSwitchScreen transition={transition}/>}
  </MotionContext.Provider>;
}
