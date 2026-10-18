"use client";

import { ArrowRight, Check, Circle, Cloud, HardDrive, LoaderCircle } from "lucide-react";

type Mode = "local" | "cloud";
type Step = { label: string; status: "pending" | "active" | "done" };
type Transition =
  | { kind: "opening"; mode: Mode; steps: Step[] }
  | { kind: "switching"; from: Mode; to: Mode; steps: Step[] };

const modeLabel: Record<Mode, string> = { local: "本地数据", cloud: "云端数据" };
const ModeIcon = ({ mode, size = 17 }: { mode: Mode; size?: number }) =>
  mode === "cloud" ? <Cloud size={size} /> : <HardDrive size={size} />;

export function DataTransitionOverlay({ transition }: { transition: Transition | null }) {
  const switching = transition?.kind === "switching";
  const targetMode = !transition ? "local" : transition.kind === "opening" ? transition.mode : transition.to;
  return (
    <div
      role="status"
      aria-hidden={!transition}
      aria-live="polite"
      aria-busy={!!transition}
      className={`fixed inset-0 z-[100] grid place-items-center bg-[radial-gradient(ellipse_at_50%_38%,#e8f5ff_0%,#f7fbff_58%,#f5f9fd_100%)] px-4 transition-opacity duration-300 motion-reduce:transition-none ${transition ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div className={`w-full max-w-[360px] rounded-[26px] border border-white/90 bg-white/90 px-6 py-6 shadow-[0_22px_75px_rgba(42,91,139,0.12),inset_0_1px_0_white] backdrop-blur-sm ${transition ? "data-space-enter" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eaf5ff] text-[#3186d9] ring-1 ring-[#dceeff]">
            <span aria-hidden="true" className="absolute -inset-1.5 rounded-[20px] border border-[#8bc7fb]/50 data-space-orbit motion-reduce:animate-none" />
            <ModeIcon mode={targetMode} size={20} />
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#36b89a] shadow-[0_0_0_3px_white] data-space-orbit motion-reduce:animate-none" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[.2em] text-[#4389c8]">MOONCLEAN OS</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-[#172b45]">
              {switching ? `正在切换到${modeLabel[targetMode]}` : "正在准备经营空间"}
            </h2>
            {switching && transition?.kind === "switching" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#74889c]">
                <ModeIcon mode={transition.from} size={13} />{modeLabel[transition.from]}
                <ArrowRight size={12} />
                <ModeIcon mode={transition.to} size={13} />{modeLabel[transition.to]}
              </p>
            )}
          </div>
          <LoaderCircle className="size-[18px] shrink-0 animate-spin text-[#3b91eb] motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <div className="mt-5 space-y-2.5 border-t border-[#edf2f7] pt-4">
          {(transition?.steps || []).map((step, index) => (
            <div key={`${index}-${step.label}`} className={`flex items-center gap-2.5 text-xs ${step.status === "pending" ? "text-[#a3b0bd]" : "text-[#526a80]"}`}>
              <span className={`grid size-[18px] shrink-0 place-items-center rounded-full ${step.status === "done" ? "bg-[#e7f7f2] text-[#16a085]" : step.status === "active" ? "bg-[#e9f4ff] text-[#3186d9]" : "text-[#c3ced8]"}`}>
                {step.status === "done" ? <Check size={12} strokeWidth={2.5} /> : step.status === "active" ? <LoaderCircle size={12} className="animate-spin motion-reduce:animate-none" /> : <Circle size={10} />}
              </span>
              <span className="flex-1">{step.label}</span>
              <span className="text-[10px]">{step.status === "done" ? "已完成" : step.status === "active" ? "处理中" : "等待中"}</span>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-[#eaf2f8]">
          <span className="data-space-progress block h-full w-2/5 rounded-full bg-[#3b91eb] motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
