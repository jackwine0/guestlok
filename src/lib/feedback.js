import { createContext, useContext } from "react";

/**
 * App-wide feedback: toasts, confirm dialogs and a name prompt.
 * Provided by <FeedbackProvider> (components/Feedback.jsx).
 *
 *   const { toast, confirm, ask } = useFeedback();
 *   toast("Saved");                                  // success by default
 *   toast("Couldn’t save", { tone: "error" });
 *   toast("Ada is at the gate", { tone: "info", action: { label: "View", onClick } });
 *   if (await confirm({ title: "End event?", body: "…", confirmLabel: "End event", danger: true })) …
 *   // A third choice: resolves "extra" when picked (true = confirm, false = cancel/close).
 *   await confirm({ title, confirmLabel: "Save and leave", extraLabel: "Leave without saving", cancelLabel: "Keep editing" })
 *   const name = await ask({ title: "What should we call you?", label: "Your name" });
 */
export const FeedbackContext = createContext(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
