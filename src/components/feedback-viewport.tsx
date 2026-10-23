"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { FEEDBACK_EVENT, type FeedbackMessage } from "@/lib/feedback";
import { useMotionPreferences } from "@/components/motion-preferences";

type Toast = FeedbackMessage & { id: number; exiting: boolean };

export function FeedbackViewport() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { notificationStyle, notificationMotion, notificationSpeed, level, reducedMotion } = useMotionPreferences();
  const timers = useRef(new Map<number, number>());
  const exitTimers = useRef(new Map<number, number>());
  const motionState = useRef({ level, reducedMotion, notificationSpeed });

  useEffect(() => {
    motionState.current = { level, reducedMotion, notificationSpeed };
  }, [level, reducedMotion, notificationSpeed]);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    if (motionState.current.reducedMotion || motionState.current.level === "simple") {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      return;
    }
    if (exitTimers.current.has(id)) return;
    setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, exiting: true } : toast));
    exitTimers.current.set(id, window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      exitTimers.current.delete(id);
    }, motionState.current.notificationSpeed === "fast" ? 140 : motionState.current.notificationSpeed === "elegant" ? 280 : 200));
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    const activeExitTimers = exitTimers.current;
    const receive = (event: Event) => {
      const message = (event as CustomEvent<FeedbackMessage>).detail;
      if (!message?.title) return;
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-2), { ...message, id, exiting: false }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), message.kind === "error" ? 6200 : 4200));
    };
    window.addEventListener(FEEDBACK_EVENT, receive);
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, receive);
      activeTimers.forEach(window.clearTimeout);
      activeExitTimers.forEach(window.clearTimeout);
      activeTimers.clear();
      activeExitTimers.clear();
    };
  }, [dismiss]);

  if (!toasts.length) return null;
  return <div className={`feedback-viewport feedback-viewport-${notificationStyle}`} aria-label="操作通知">
    {toasts.map((toast) => {
      const Icon = toast.kind === "success" ? Check : toast.kind === "error" ? CircleAlert : Info;
      return <div key={toast.id} className={`feedback-toast feedback-toast-${toast.kind} feedback-toast-${notificationStyle} feedback-toast-motion-${notificationMotion} feedback-toast-speed-${notificationSpeed}${toast.exiting ? " is-exiting" : ""}`} role={toast.kind === "error" ? "alert" : "status"}>
        <span className="feedback-toast-icon"><Icon size={17} /></span>
        <span className="feedback-toast-copy">
          <span className="feedback-toast-heading"><strong>{toast.title}</strong><time>刚刚</time></span>
          {toast.description && <small>{toast.description}</small>}
          {toast.action && <button type="button" className="feedback-toast-action" onClick={() => { toast.action?.onClick(); dismiss(toast.id); }}>{toast.action.label}</button>}
        </span>
        <button type="button" aria-label="关闭通知" onClick={() => dismiss(toast.id)}><X size={15} /></button>
      </div>;
    })}
  </div>;
}
