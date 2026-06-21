// Desktop notifications + sound bell.
// Works in browsers and Electron. Silently no-ops if unsupported.
import { sounds } from "./sounds";

export type NotifyKind = "info" | "success" | "warn" | "error";

export function requestNotifyPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function notify(title: string, body?: string, kind: NotifyKind = "info") {
  // Always play matching sound — works even if OS notifications are blocked.
  if (kind === "error") sounds.error();
  else if (kind === "warn") sounds.warn();
  else if (kind === "success") sounds.success();
  else sounds.click();

  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      const n = new Notification(title, { body, silent: false });
      setTimeout(() => n.close?.(), 6000);
    }
  } catch {
    /* ignore */
  }
}
