"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Sparkles, Zap } from "lucide-react";

export type MotionLevel = "refined" | "standard" | "simple";
export const MOTION_LEVELS: { id: MotionLevel; label: string; short: string; detail: string; experience: string }[] = [
  { id: "refined", label: "精致", short: "最大的特效", detail: "液态玻璃底栏、粒子光点、柔光层次、浮层入场与更丰富的点击反馈。", experience: "视觉最丰富 · 合成效果更多" },
  { id: "standard", label: "标准", short: "中等的特效", detail: "保留当前的轻量淡入、卡片微动、底栏滑动和半透明材质。", experience: "轻盈克制 · 日常推荐" },
  { id: "simple", label: "简单", short: "没有动效", detail: "关闭动效、毛玻璃、活动滑块和动态阴影，界面静态直切。", experience: "静态直接 · 最省资源" },
];

type MotionTransition = { id: number; from: MotionLevel; to: MotionLevel; step: number };
type MotionContextValue = { level: MotionLevel; ready: boolean; setLevel: (level: MotionLevel) => void };
const STORAGE_KEY = "moonclean-motion-level-v1";
const STEPS = ["保存本机动效偏好", "更新全站视觉材质", "切换底栏与页面反馈", "完成体验配置"];
const MotionContext = createContext<MotionContextValue | null>(null);

export function useMotionPreferences() {
  const value = useContext(MotionContext);
  if (!value) throw new Error("useMotionPreferences 必须在 MotionPreferencesProvider 中使用");
  return value;
}

function MotionSwitchScreen({ transition }: { transition: MotionTransition }) {
  const target = MOTION_LEVELS.find(item => item.id === transition.to)!;
  const previous = MOTION_LEVELS.find(item => item.id === transition.from)!;
  const detailed = [
    `从「${previous.label}」切换至「${target.label}」`,
    target.id === "refined" ? "启用液态玻璃、柔光粒子与丰富的层级动效" : target.id === "standard" ? "启用轻量淡入、卡片反馈与底栏平滑位移" : "关闭动画、模糊材质与装饰性动态效果",
    "同步更新手机底栏、导航菜单与全站交互",
    "设置已保存，可随时在系统设置中切换",
  ];
  return <div className={`motion-switch-screen motion-switch-${transition.to}`} role="status" aria-live="polite" aria-label={`正在切换到${target.label}动效`}>
    {transition.to === "refined" && <div aria-hidden="true" className="motion-particle-field">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ left: `${(index * 47 + 7) % 100}%`, width: `${2 + index % 4}px`, height: `${2 + index % 4}px`, animationDuration: `${5 + index % 7}s`, animationDelay: `${index * -.53}s`, "--particle-drift": `${((index % 5) - 2) * 34}px` } as CSSProperties}/>)}</div>}
    <div className="motion-switch-orbit motion-switch-orbit-a" aria-hidden="true"/>
    <div className="motion-switch-orbit motion-switch-orbit-b" aria-hidden="true"/>
    <div className="motion-switch-panel">
      <div className="motion-switch-brand"><span className="motion-switch-icon">{transition.to === "simple" ? <Check size={24}/> : transition.to === "standard" ? <Zap size={23}/> : <Sparkles size={24}/>}</span><span>MOONCLEAN OS</span></div>
      <p className="motion-switch-kicker">全局体验正在更新</p>
      <h2>{transition.step >= STEPS.length ? `${target.label}模式已就绪` : `正在切换至「${target.label}」`}</h2>
      <p className="motion-switch-description">{target.detail}</p>
      <div className="motion-switch-steps">
        {STEPS.map((step, index) => {
          const completed = transition.step > index;
          const active = transition.step === index;
          return <div key={step} className={`motion-switch-step ${completed ? "is-done" : ""} ${active ? "is-active" : ""}`}>
            <span className="motion-switch-step-mark">{completed ? <Check size={12}/> : String(index + 1).padStart(2, "0")}</span>
            <span className="motion-switch-step-copy"><strong>{step}</strong><small>{detailed[index]}</small></span>
            <span className="motion-switch-step-status">{completed ? "完成" : active ? "处理中" : "等待"}</span>
          </div>;
        })}
      </div>
      <div className="motion-switch-progress"><span style={{ width: `${(transition.step / STEPS.length) * 100}%` }}/></div>
      <p className="motion-switch-footnote">偏好保存在当前设备，不影响你的店铺数据。</p>
    </div>
  </div>;
}

export function MotionPreferencesProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<MotionLevel>("standard");
  const [ready, setReady] = useState(false);
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
    document.documentElement.dataset.motion = level;
  }, [level]);

  useEffect(() => () => { if (timer.current !== null) window.clearInterval(timer.current); }, []);

  const setLevel = useCallback((next: MotionLevel) => {
    if (next === level) return;
    const id = ++transitionId.current;
    if (timer.current !== null) window.clearInterval(timer.current);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* This session still adopts the selected profile. */ }
    document.documentElement.dataset.motion = next;
    setLevelState(next);
    if (next === "simple") {
      setTransition({ id, from: level, to: next, step: STEPS.length });
      timer.current = window.setTimeout(() => setTransition(current => current?.id === id ? null : current), 1900);
      return;
    }
    setTransition({ id, from: level, to: next, step: 0 });
    const interval = next === "refined" ? 640 : next === "standard" ? 480 : 55;
    let step = 0;
    timer.current = window.setInterval(() => {
      step += 1;
      setTransition(current => {
        if (!current || current.id !== id) return current;
        return { ...current, step };
      });
      if (step >= STEPS.length) {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = window.setTimeout(() => setTransition(currentState => currentState?.id === id ? null : currentState), next === "refined" ? 850 : next === "standard" ? 500 : 0);
      }
    }, interval);
  }, [level]);

  return <MotionContext.Provider value={{ level, ready, setLevel }}>
    {children}
    {transition && <MotionSwitchScreen transition={transition}/>}
  </MotionContext.Provider>;
}
