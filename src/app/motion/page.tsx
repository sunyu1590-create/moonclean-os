"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleOff,
  Monitor,
  MoveUpRight,
  Sparkles,
  X,
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
  { id: "blur-fade", label: "模糊渐显", description: "淡入并逐渐清晰。", Icon: Sparkles },
  { id: "blur-lift", label: "模糊上浮", description: "轻柔上浮，卡片随滚动显现。", Icon: MoveUpRight },
];

const notificationStyles = [
  { id: "glass", title: "凝态玻璃", short: "完整", description: "展示图标、标题、时间与正文。", previewTitle: "保存成功", previewDescription: "商品资料已同步到云端。" },
  { id: "capsule", title: "紧凑玻璃", short: "紧凑", description: "单行正文，减少通知高度。", previewTitle: "已保存", previewDescription: "商品资料已同步。" },
  { id: "adaptive", title: "设备适配", short: "适配", description: "手机停靠底栏上方，桌面靠右下。", previewTitle: "保存成功", previewDescription: "商品资料已同步到云端。" },
] as const;

const notificationMotions = [
  { id: "soft", title: "柔雾显现", description: "轻微上移并逐渐清晰。", previewTitle: "保存成功" },
  { id: "expand", title: "轻柔展开", description: "舒缓放大到原位，不做弹跳。", previewTitle: "已保存" },
  { id: "directional", title: "方向滑入", description: "桌面从右侧、手机从底部进入。", previewTitle: "同步完成" },
] as const;

const notificationSpeeds = [
  { id: "fast", title: "快速", detail: "160 ms" },
  { id: "balanced", title: "均衡", detail: "270 ms" },
  { id: "elegant", title: "舒缓", detail: "390 ms" },
] as const;

function compactChoice(selected: boolean) {
  return cn(
    "motion-choice-card relative flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors sm:min-h-[76px] sm:rounded-2xl sm:px-3",
    selected
      ? "motion-choice-selected border-border bg-[var(--mc-tint-blue)] text-primary shadow-[0_3px_12px_rgba(59,145,235,.09)]"
      : "border-border bg-card text-muted-foreground hover:bg-[var(--mc-tint-blue)]",
  );
}

function SelectedNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 rounded-lg bg-[var(--mc-tint-blue)] px-3 py-2 text-[11px] leading-4 text-muted-foreground sm:text-xs">{children}</p>;
}

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

  const selectedLevel = MOTION_LEVELS.find((item) => item.id === level) || MOTION_LEVELS[1];
  const selectedTransition = transitionStyles.find((item) => item.id === pageTransitionStyle) || transitionStyles[0];
  const selectedNotification = notificationStyles.find((item) => item.id === notificationStyle) || notificationStyles[0];
  const selectedNotificationMotion = notificationMotions.find((item) => item.id === notificationMotion) || notificationMotions[0];
  const selectedSpeed = notificationSpeeds.find((item) => item.id === notificationSpeed) || notificationSpeeds[1];

  return (
    <>
      <PageHead
        eyebrow="PREFERENCES / MOTION"
        title="动效设置"
        description="调整全站动效和通知表现；设置保存在当前设备。"
      />

      <div className="space-y-3 md:space-y-5">
        <SectionCard title="全站动效档位" sub="控制页面切换、加载反馈、导航与交互状态。" action={<Sparkles size={19} className="text-primary" />}>
          <div role="group" aria-label="全站动效档位" className="grid grid-cols-3 gap-2">
            {MOTION_LEVELS.map((option) => {
              const selected = level === option.id;
              const Icon = option.id === "refined" ? Sparkles : option.id === "standard" ? Zap : CircleOff;
              return (
                <button key={option.id} type="button" disabled={!ready} aria-pressed={selected} onClick={() => setLevel(option.id as MotionLevel)} className={cn(compactChoice(selected), !ready && "cursor-wait opacity-70")}>
                  {selected && <Check size={12} className="absolute right-2 top-2" />}
                  <Icon size={17} />
                  <strong className="max-w-full truncate text-xs font-semibold sm:text-sm">{option.label}</strong>
                  <span className="max-w-full truncate text-[9px] leading-3 text-muted-foreground sm:text-[10px]">{option.short}</span>
                </button>
              );
            })}
          </div>
          <SelectedNote>当前：{selectedLevel.label} · {selectedLevel.detail}</SelectedNote>
        </SectionCard>

        <SectionCard title="页面切换方式" sub="选择页面过渡效果。" action={<MoveUpRight size={19} className="text-primary" />}>
          <div role="group" aria-label="页面切换方式" className="grid grid-cols-2 gap-2">
            {transitionStyles.map(({ id, label, Icon }) => {
              const selected = pageTransitionStyle === id;
              return (
                <button key={id} type="button" aria-pressed={selected} onClick={() => setPageTransitionStyle(id)} className={compactChoice(selected)}>
                  {selected && <Check size={12} className="absolute right-2 top-2" />}
                  <span className="flex items-center gap-1.5"><Icon size={15} /><strong className="text-[11px] font-semibold sm:text-sm">{label}</strong></span>
                </button>
              );
            })}
          </div>
          <SelectedNote>当前：{selectedTransition.description} {level === "simple" || reducedMotion ? "Low 档或系统减少动态效果开启时会静态呈现。" : ""}</SelectedNote>
        </SectionCard>

        <SectionCard title="操作通知样式" sub="自定义成功、错误和操作提示的显示方式。" action={<Sparkles size={19} className="text-primary" />}>
          <div role="group" aria-label="操作通知样式" className="grid grid-cols-3 gap-2">
            {notificationStyles.map((option) => {
              const selected = notificationStyle === option.id;
              return (
                <button key={option.id} type="button" disabled={!ready} aria-pressed={selected} onClick={() => setNotificationStyle(option.id as NotificationStyle)} className={cn(compactChoice(selected), !ready && "cursor-wait opacity-70")}>
                  {selected && <Check size={12} className="absolute right-2 top-2" />}
                  <strong className="max-w-full truncate text-[11px] font-semibold sm:text-sm">{option.title}</strong>
                  <span className="text-[9px] leading-3 text-muted-foreground sm:text-[10px]">{option.short}</span>
                </button>
              );
            })}
          </div>
          <SelectedNote>{selectedNotification.description}</SelectedNote>
          <div className={cn("feedback-toast-preview !mt-2 !min-h-16", notificationStyle === "adaptive" && "feedback-toast-preview-adaptive !min-h-[76px] !pb-2")} aria-label="通知样式预览">
            <span className={cn("feedback-toast feedback-toast-success", `feedback-toast-${notificationStyle}`)}>
              <span className="feedback-toast-icon"><Check size={15} /></span>
              <span className="feedback-toast-copy">
                <span className="feedback-toast-heading"><strong>{selectedNotification.previewTitle}</strong><time>刚刚</time></span>
                <small>{selectedNotification.previewDescription}</small>
              </span>
              <span className="feedback-toast-preview-close" aria-hidden="true"><X size={13} /></span>
            </span>
          </div>
        </SectionCard>

        <SectionCard title="通知入场动效" sub="与上方任意通知样式搭配。" action={<MoveUpRight size={19} className="text-primary" />}>
          <div role="group" aria-label="通知入场动效" className="grid grid-cols-3 gap-2">
            {notificationMotions.map((option) => {
              const selected = notificationMotion === option.id;
              return (
                <button key={option.id} type="button" disabled={!ready} aria-pressed={selected} onClick={() => setNotificationMotion(option.id as NotificationMotion)} className={cn(compactChoice(selected), !ready && "cursor-wait opacity-70")}>
                  {selected && <Check size={12} className="absolute right-2 top-2" />}
                  <strong className="max-w-full truncate text-[11px] font-semibold sm:text-sm">{option.title}</strong>
                </button>
              );
            })}
          </div>
          <SelectedNote>{selectedNotificationMotion.description} {level === "simple" || reducedMotion ? "系统减少动态效果或 Low 档会直接显示和收起。" : ""}</SelectedNote>
          <div className="feedback-toast-preview !mt-2 !min-h-16" aria-label="通知动效预览">
            <span className={`feedback-toast feedback-toast-success feedback-toast-glass feedback-toast-motion-${notificationMotion} feedback-toast-motion-demo`}>
              <span className="feedback-toast-icon"><Check size={15} /></span>
              <span className="feedback-toast-copy"><strong>{selectedNotificationMotion.previewTitle}</strong><small>商品资料已同步。</small></span>
            </span>
          </div>
        </SectionCard>

        <SectionCard title="通知动效速度" sub="控制通知出现和收起的节奏。" action={<Zap size={19} className="text-primary" />}>
          <div role="group" aria-label="通知动效速度" className="grid grid-cols-3 gap-2">
            {notificationSpeeds.map((option) => {
              const selected = notificationSpeed === option.id;
              return (
                <button key={option.id} type="button" disabled={!ready} aria-pressed={selected} onClick={() => setNotificationSpeed(option.id as NotificationSpeed)} className={cn(compactChoice(selected), !ready && "cursor-wait opacity-70")}>
                  {selected && <Check size={12} className="absolute right-2 top-2" />}
                  <strong className="text-xs font-semibold sm:text-sm">{option.title}</strong>
                  <span className="text-[10px] text-muted-foreground">{option.detail}</span>
                </button>
              );
            })}
          </div>
          <SelectedNote>当前：{selectedSpeed.title} · 入场约 {selectedSpeed.detail}，退出节奏会同步调整。</SelectedNote>
        </SectionCard>

        <SectionCard title="系统动态效果偏好" sub="无障碍设置优先于应用内动效档位。" action={<Monitor size={19} className="text-primary" />}>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[var(--mc-tint-blue)] px-3 py-2.5 sm:p-4">
            <div className="min-w-0">
              <strong className="block text-xs text-foreground sm:text-sm">减少动态效果</strong>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground sm:text-xs">开启后，过渡和装饰动效会自动关闭。</p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:py-1.5 sm:text-xs", reducedMotion ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-card text-muted-foreground")}>
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
