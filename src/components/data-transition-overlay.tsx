"use client";

import Image from "next/image";
import { ArrowRight, Cloud, HardDrive } from "lucide-react";

type Mode = "local" | "cloud";
type Transition = { kind: "opening" } | { kind: "switching"; from: Mode; to: Mode };

const modeLabel: Record<Mode, string> = { local: "本地数据", cloud: "云端数据" };
const ModeIcon = ({ mode, size = 17 }: { mode: Mode; size?: number }) =>
  mode === "cloud" ? <Cloud size={size} /> : <HardDrive size={size} />;

export function DataTransitionOverlay({ transition }: { transition: Transition | null }) {
  const switching = transition?.kind === "switching";
  return (
    <div
      role="status"
      aria-hidden={!transition}
      aria-live="polite"
      aria-busy={!!transition}
      className={`fixed inset-0 z-[100] grid place-items-center bg-[radial-gradient(ellipse_at_50%_38%,#e8f5ff_0%,#f7fbff_58%,#f5f9fd_100%)] px-5 transition-opacity duration-300 motion-reduce:transition-none ${transition ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div className={`w-full max-w-sm rounded-[30px] border border-white/90 bg-white/80 px-8 py-9 text-center shadow-[0_22px_75px_rgba(42,91,139,0.12),inset_0_1px_0_white] backdrop-blur-sm ${transition ? "data-space-enter" : ""}`}>
        <div className="relative mx-auto mb-6 grid size-[88px] place-items-center rounded-[27px] bg-[#f2f9ff] ring-1 ring-[#dceeff]">
          <span aria-hidden="true" className="absolute -inset-2 rounded-[31px] border border-[#8bc7fb]/45 data-space-orbit motion-reduce:animate-none" />
          <Image src="/yue-ming-jing-logo.png" alt="月明净" width={68} height={68} className="size-[68px] object-contain" priority />
        </div>
        <p className="text-[11px] font-semibold tracking-[.22em] text-[#4389c8]">MOONCLEAN OS</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#172b45]">
          {switching ? `正在切换到${modeLabel[transition.to]}` : "正在准备经营空间"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#74889c]">
          {switching
            ? transition.to === "local"
              ? "正在读取此设备保存的数据，云端数据不会被覆盖。"
              : "正在安全连接店铺并读取最新经营数据。"
            : "正在读取当前工作区，马上为你呈现最新状态。"}
        </p>
        {switching && (
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#e8eff6] bg-white px-4 py-2.5 text-xs font-medium text-[#60768b]">
            <span className="inline-flex items-center gap-1.5"><ModeIcon mode={transition.from} size={15}/>{modeLabel[transition.from]}</span>
            <ArrowRight size={14} className="text-[#9aafc2]" />
            <span className="inline-flex items-center gap-1.5 text-[#287fe2]"><ModeIcon mode={transition.to} size={15}/>{modeLabel[transition.to]}</span>
          </div>
        )}
        <div aria-hidden="true" className="mx-auto mt-7 h-1 w-36 overflow-hidden rounded-full bg-[#eaf2f8]">
          <span className="data-space-progress block h-full w-2/5 rounded-full bg-[#3b91eb] motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
