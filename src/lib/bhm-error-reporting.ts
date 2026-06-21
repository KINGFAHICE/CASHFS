type BhmErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type BhmEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: BhmErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __bhmEvents?: BhmEvents;
  }
}

export function reportBhmError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__bhmEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
