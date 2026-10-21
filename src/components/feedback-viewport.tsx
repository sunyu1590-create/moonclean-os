"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { FEEDBACK_EVENT, type FeedbackMessage } from "@/lib/feedback";
import { useMotionPreferences } from "@/components/motion-preferences";

type Toast = FeedbackMessage & { id: number };

export function FeedbackViewport() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { notificationStyle } = useMotionPreferences();

  useEffect(() => {
    const timers = new Map<number, number>();
    const receive = (event: Event) => {
      const message = (event as CustomEvent<FeedbackMessage>).detail;
      if (!message?.title) return;
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-2), { ...message, id }]);
      timers.set(id, window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timers.delete(id);
      }, message.kind === "error" ? 6200 : 4200));
    };
    window.addEventListener(FEEDBACK_EVENT, receive);
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, receive);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  function dismiss(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  if (!toasts.length) return null;
  return <div className="feedback-viewport" aria-label="操作通知">
    {toasts.map((toast) => {
      const Icon = toast.kind === "success" ? Check : toast.kind === "error" ? CircleAlert : Info;
      return <div key={toast.id} className={`feedback-toast feedback-toast-${toast.kind} feedback-toast-${notificationStyle}`} role={toast.kind === "error" ? "alert" : "status"}>
        <span className="feedback-toast-icon"><Icon size={17} /></span>
        <span className="feedback-toast-copy"><strong>{toast.title}</strong>{toast.description && <small>{toast.description}</small>}</span>
        <button type="button" aria-label="关闭通知" onClick={() => dismiss(toast.id)}><X size={15} /></button>
      </div>;
    })}
  </div>;
}
