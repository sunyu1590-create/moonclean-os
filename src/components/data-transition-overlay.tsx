"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Circle, Cloud, HardDrive, LoaderCircle } from "lucide-react";
import { APP_VERSION } from "@/lib/release-notes";
import { MOTION_LEVELS, useMotionPreferences } from "@/components/motion-preferences";

type Mode = "local" | "cloud";
type Step = { label: string; status: "pending" | "active" | "done" };
type Transition =
  | { kind: "opening"; mode: Mode; steps: Step[] }
  | { kind: "switching"; from: Mode; to: Mode; steps: Step[] };

const modeLabel: Record<Mode, string> = { local: "本地数据", cloud: "云端数据" };
const ModeIcon = ({ mode, size = 17 }: { mode: Mode; size?: number }) =>
  mode === "cloud" ? <Cloud size={size} /> : <HardDrive size={size} />;

export function DataTransitionOverlay({ transition }: { transition: Transition | null }) {
  const { level, ready, reducedMotion } = useMotionPreferences();
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressRef = useRef(0);
  const steps = transition?.steps ?? [];
  const completedSteps = steps.filter((step) => step.status === "done").length;
  const activeStep = steps.findIndex((step) => step.status === "active");
  const complete = steps.length > 0 && completedSteps === steps.length;

  useEffect(() => {
    if (!transition) {
      progressRef.current = 0;
      setAnimatedProgress(0);
      return;
    }
    if (complete) {
      progressRef.current = 100;
      setAnimatedProgress(100);
      return;
    }
    if (reducedMotion || level === "simple") {
      const staticProgress = steps.length
        ? ((completedSteps + (activeStep >= 0 ? 1 : 0)) / steps.length) * 100
        : 0;
      progressRef.current = Math.min(98, staticProgress);
      setAnimatedProgress(progressRef.current);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(now - startedAt, 5_000);
      const activeFraction = activeStep >= 0 ? Math.min(0.92, elapsed / 5_000 * 0.92) : 0;
      const target = steps.length
        ? Math.min(98, ((completedSteps + activeFraction) / steps.length) * 100)
        : 0;
      progressRef.current += (target - progressRef.current) * 0.065;
      setAnimatedProgress(progressRef.current);
      if ((activeStep >= 0 && elapsed < 5_000) || Math.abs(target - progressRef.current) > 0.15) {
        frame = window.requestAnimationFrame(animate);
      }
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [transition, steps.length, completedSteps, activeStep, complete, reducedMotion, level]);

  if (!transition) return null;
  const switching = transition?.kind === "switching";
  const progressPercent = complete ? 100 : Math.min(98, Math.round(animatedProgress));
  const targetMode = !transition ? "local" : transition.kind === "opening" ? transition.mode : transition.to;
  const motionLabel = MOTION_LEVELS.find((item) => item.id === level)?.label || "Standard";
  return (
    <div
      role="status"
      aria-hidden={!transition}
      aria-live="polite"
      aria-busy={!!transition}
      className={`data-transition-screen data-transition-${level} ${complete ? "data-transition-complete" : ""} ${reducedMotion ? "data-transition-reduced" : ""} fixed inset-0 z-[100] grid place-items-center px-4 transition-opacity duration-300 motion-reduce:transition-none opacity-100`}
    >
      <div className={`data-transition-card w-full max-w-[380px] rounded-[28px] border border-white/90 bg-card/90 px-5 py-5 shadow-[0_22px_75px_rgba(42,91,139,0.12),inset_0_1px_0_white] sm:px-7 sm:py-6 ${transition ? "data-space-enter" : ""}`}>
        <div className="flex items-center gap-4">
          <div className="data-mode-emblem relative grid size-[58px] shrink-0 place-items-center rounded-[20px] bg-[var(--mc-tint-blue)] text-primary shadow-[0_8px_25px_rgba(37,108,162,.12)] ring-1 ring-white">
            <span aria-hidden="true" className="data-mode-orbit" />
            <ModeIcon mode={targetMode} size={22} />
            <span aria-hidden="true" className="data-mode-particle data-mode-particle-one" />
            <span aria-hidden="true" className="data-mode-particle data-mode-particle-two" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
              {switching ? `正在切换到${modeLabel[targetMode]}` : "正在准备经营空间"}
            </h2>
            {switching && transition?.kind === "switching" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ModeIcon mode={transition.from} size={13} />{modeLabel[transition.from]}
                <ArrowRight size={12} />
                <ModeIcon mode={transition.to} size={13} />{modeLabel[transition.to]}
              </p>
            )}
          </div>
          <LoaderCircle className="data-loader-spinner size-[18px] shrink-0 text-primary" aria-hidden="true" />
        </div>
        <div className="mt-5 space-y-2.5 border-t border-border pt-4">
          {steps.map((step, index) => (
            <div key={`${index}-${step.label}`} className={`flex items-center gap-2.5 text-xs ${step.status === "pending" ? "text-muted-foreground" : "text-muted-foreground"}`}>
              <span className={`data-step-icon grid size-[18px] shrink-0 place-items-center rounded-full ${step.status === "done" ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : step.status === "active" ? "bg-[var(--mc-tint-blue)] text-primary" : "text-muted-foreground"}`}>
                {step.status === "done" ? <Check size={12} strokeWidth={2.5} /> : step.status === "active" ? <LoaderCircle size={12} className="data-loader-spinner" /> : <Circle size={10} />}
              </span>
              <span className="flex-1">{step.label}</span>
              <span className="text-[10px]">{step.status === "done" ? "已完成" : step.status === "active" ? "处理中" : "等待中"}</span>
            </div>
          ))}
        </div>
        <div className="data-transition-progress mt-4" aria-label="加载阶段进度">
          <div className="mb-2 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span>{complete ? "准备完成" : "阶段进度"}</span>
            <span className="tabular-nums text-xs font-semibold text-primary">{progressPercent}%</span>
          </div>
          <div role="progressbar" aria-label="加载阶段进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="h-1.5 overflow-hidden rounded-full bg-[var(--mc-tint-blue)]">
            <span className="data-space-progress block h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <p className="mt-3 flex items-center justify-between text-[10px] font-medium tracking-wide text-muted-foreground"><span>v{APP_VERSION}</span><span>{ready ? `${motionLabel}动效` : "正在读取动效档位"}</span></p>
      </div>
    </div>
  );
}
