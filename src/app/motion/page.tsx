"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleOff,
  Monitor,
  MoveUpRight,
  Sparkles,
  Zap,
} from "lucide-react";
import { PageHead, SectionCard } from "@/components/common";
import {
  MOTION_LEVELS,
  useMotionPreferences,
  type MotionLevel,
  type PageTransitionStyle,
} from "@/components/motion-preferences";
import { cn } from "@/lib/utils";

const transitionStyles: {
  id: PageTransitionStyle;
  label: string;
  description: string;
  Icon: typeof Sparkles;
}[] = [
  { id: "blur-fade", label: "模糊渐显", description: "页面淡入并逐渐清晰。", Icon: Sparkles },
  { id: "blur-lift", label: "模糊上浮", description: "页面轻柔上浮；主要卡片随滚动进入视口依次显现。", Icon: MoveUpRight },
];

export default function MotionSettingsPage() {
  const {
    level,
    ready,
    setLevel,
    pageTransitionStyle,
    setPageTransitionStyle,
    reducedMotion,
  } = useMotionPreferences();

  return (
    <>
      <PageHead
        eyebrow="PREFERENCES / MOTION"
        title="动效设置"
        description="统一调整全站动效强度和页面切换方式。设置保存在当前设备，不会同步店铺数据。"
      />

      <div className="space-y-5">
        <SectionCard
          title="全站动效档位"
          sub="即时应用到页面过渡、加载反馈、导航和交互状态。"
          action={<Sparkles size={19} className="text-primary" />}
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {MOTION_LEVELS.map((option) => {
              const selected = level === option.id;
              const Icon = option.id === "refined" ? Sparkles : option.id === "standard" ? Zap : CircleOff;
              const details = option.id === "refined"
                ? "流光选中、高光背景、彩色加载 Shimmer 和细腻的滚动入场。"
                : option.id === "standard"
                  ? "保留必要的页面过渡与基础交互反馈。"
                  : "关闭装饰性动效，直接呈现页面内容。";

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!ready}
                  aria-pressed={selected}
                  onClick={() => setLevel(option.id as MotionLevel)}
                  className={cn(
                    "motion-choice-card relative flex min-h-36 flex-col rounded-2xl border p-4 text-left",
                    selected
                      ? "motion-choice-selected border-border bg-[var(--mc-tint-blue)] shadow-[0_5px_18px_rgba(59,145,235,.12)]"
                      : "border-border bg-card hover:border-border",
                    !ready && "cursor-wait opacity-70",
                  )}
                >
                  {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={12} /></span>}
                  <span className={cn("mb-3 grid size-10 place-items-center rounded-[14px]", selected ? "bg-card text-primary" : "bg-[var(--mc-tint-blue)] text-muted-foreground")}>
                    <Icon size={19} />
                  </span>
                  <strong className="text-sm font-semibold text-foreground">{option.label}<span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{option.short}</span></strong>
                  <span className="mt-1 text-[10px] font-medium text-primary">{option.experience}</span>
                  <span className="mt-2 text-xs leading-5 text-muted-foreground">{details}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="页面切换方式"
          sub="选择浏览器内页面切换时使用的过渡效果。"
          action={<MoveUpRight size={19} className="text-primary" />}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {transitionStyles.map(({ id, label, description, Icon }) => {
              const selected = pageTransitionStyle === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPageTransitionStyle(id)}
                  className={cn(
                    "flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
                    selected ? "border-border bg-[var(--mc-tint-blue)] text-primary" : "border-border bg-card text-muted-foreground hover:bg-[var(--mc-tint-blue)]",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card"><Icon size={19} /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
                  {selected && <Check size={16} className="shrink-0" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs leading-5 text-muted-foreground">
            页面过渡在 Low 档或系统减少动态效果开启时会静态呈现。滚动入场跟随“模糊上浮”选项生效。
          </p>
        </SectionCard>

        <SectionCard
          title="系统动态效果偏好"
          sub="应用会遵守设备的无障碍动态效果设置。此状态由操作系统和浏览器管理。"
          action={<Monitor size={19} className="text-primary" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4">
            <div>
              <strong className="block text-sm text-foreground">减少动态效果</strong>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">开启后，页面过渡、滚动入场和装饰动画会自动关闭。</p>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              reducedMotion ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-card text-muted-foreground",
            )}>
              {ready ? reducedMotion ? "系统已开启" : "系统未开启" : "读取中"}
            </span>
          </div>
        </SectionCard>

        <Link href="/settings" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft size={16} />返回系统设置
        </Link>
      </div>
    </>
  );
}
