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
  type NotificationMotion,
  type NotificationSpeed,
  type NotificationStyle,
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
    notificationStyle,
    setNotificationStyle,
    notificationMotion,
    setNotificationMotion,
    notificationSpeed,
    setNotificationSpeed,
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
          title="操作通知样式"
          sub="选择保存结果、错误和操作提示在全站的显示方式；偏好保存在当前设备。"
          action={<Sparkles size={19} className="text-primary" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { id: "glass", title: "精致玻璃卡片", description: "层级清晰，标题与说明完整展示。", previewTitle: "保存成功", previewDescription: "商品资料已同步到云端。" },
              { id: "capsule", title: "紧凑状态胶囊", description: "更轻巧的圆润提示，适合快速确认。", previewTitle: "已保存", previewDescription: "商品资料已同步。" },
              { id: "adaptive", title: "设备适配：桌面横幅 / 手机底部提示", description: "桌面使用 macOS 风格状态横幅；手机提示自动出现在底栏上方。", previewTitle: "保存成功", previewDescription: "商品资料已同步到云端。" },
            ] as const).map((option) => {
              const selected = notificationStyle === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!ready}
                  aria-pressed={selected}
                  onClick={() => setNotificationStyle(option.id as NotificationStyle)}
                  className={cn(
                    "motion-choice-card relative flex min-h-36 flex-col gap-3 rounded-2xl border p-4 text-left",
                    selected ? "motion-choice-selected border-border bg-[var(--mc-tint-blue)] shadow-[0_5px_18px_rgba(59,145,235,.12)]" : "border-border bg-card hover:border-border",
                    !ready && "cursor-wait opacity-70",
                  )}
                >
                  {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={12} /></span>}
                  <span className="text-sm font-semibold text-foreground">{option.title}</span>
                  <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
                  <span className="feedback-toast-preview">
                    <span className={`feedback-toast feedback-toast-success feedback-toast-${option.id}`}>
                      <span className="feedback-toast-icon"><Check size={15} /></span>
                      <span className="feedback-toast-copy"><strong>{option.previewTitle}</strong><small>{option.previewDescription}</small></span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="通知入场动效"
          sub="选择全站通知的出现与收起方式；可与上方任意通知样式搭配。"
          action={<MoveUpRight size={19} className="text-primary" />}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { id: "soft", title: "柔雾显现", description: "轻微上移并从柔焦中清晰显现。", previewTitle: "保存成功" },
              { id: "expand", title: "轻柔展开", description: "从略小尺寸舒缓放大到原位，不做弹跳。", previewTitle: "已保存" },
              { id: "directional", title: "方向滑入", description: "桌面从右侧进入；手机从底部进入。", previewTitle: "同步完成" },
            ] as const).map((option) => {
              const selected = notificationMotion === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!ready}
                  aria-pressed={selected}
                  onClick={() => setNotificationMotion(option.id as NotificationMotion)}
                  className={cn(
                    "motion-choice-card relative flex min-h-36 flex-col gap-3 rounded-2xl border p-4 text-left",
                    selected ? "motion-choice-selected border-border bg-[var(--mc-tint-blue)] shadow-[0_5px_18px_rgba(59,145,235,.12)]" : "border-border bg-card hover:border-border",
                    !ready && "cursor-wait opacity-70",
                  )}
                >
                  {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={12} /></span>}
                  <span className="text-sm font-semibold text-foreground">{option.title}</span>
                  <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
                  <span className="feedback-toast-preview">
                    <span className={`feedback-toast feedback-toast-success feedback-toast-glass feedback-toast-motion-${option.id} feedback-toast-motion-demo`}>
                      <span className="feedback-toast-icon"><Check size={15} /></span>
                      <span className="feedback-toast-copy"><strong>{option.previewTitle}</strong><small>商品资料已同步。</small></span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs leading-5 text-muted-foreground">
            系统开启“减少动态效果”或选择 Low 档时，通知会直接显示和收起。
          </p>
        </SectionCard>

        <SectionCard
          title="通知动效速度"
          sub="调整入场、停留结束和手动关闭时的节奏。此设置适用于当前所有通知样式与动效。"
          action={<Zap size={19} className="text-primary" />}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { id: "fast", title: "快速", description: "约 160ms 入场，响应利落。" },
              { id: "balanced", title: "均衡", description: "约 270ms 入场，轻快且舒展。" },
              { id: "elegant", title: "优雅", description: "约 390ms 入场，节奏更从容。" },
            ] as const).map((option) => {
              const selected = notificationSpeed === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!ready}
                  aria-pressed={selected}
                  onClick={() => setNotificationSpeed(option.id as NotificationSpeed)}
                  className={cn(
                    "motion-choice-card relative flex min-h-32 flex-col gap-3 rounded-2xl border p-4 text-left",
                    selected ? "motion-choice-selected border-border bg-[var(--mc-tint-blue)] shadow-[0_5px_18px_rgba(59,145,235,.12)]" : "border-border bg-card hover:border-border",
                    !ready && "cursor-wait opacity-70",
                  )}
                >
                  {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={12} /></span>}
                  <span className="text-sm font-semibold text-foreground">{option.title}</span>
                  <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
                  <span className="feedback-toast-preview">
                    <span className={`feedback-toast feedback-toast-success feedback-toast-glass feedback-toast-motion-soft feedback-toast-speed-${option.id} feedback-toast-motion-demo`}>
                      <span className="feedback-toast-icon"><Check size={15} /></span>
                      <span className="feedback-toast-copy"><strong>保存成功</strong><small>商品资料已同步。</small></span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
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
