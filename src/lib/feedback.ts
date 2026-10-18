export type FeedbackKind = "success" | "error" | "info";

export type FeedbackMessage = {
  kind: FeedbackKind;
  title: string;
  description?: string;
};

export const FEEDBACK_EVENT = "moonclean:feedback";

export function notifyFeedback(message: FeedbackMessage): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FeedbackMessage>(FEEDBACK_EVENT, { detail: message }));
}
