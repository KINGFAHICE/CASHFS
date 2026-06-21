import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { db, type AppSettings, defaultSettings } from "./db";

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const FONT_OPTIONS = [
  { id: "Inter", label: "Inter (default)", stack: '"Inter", system-ui, sans-serif' },
  { id: "Space Grotesk", label: "Space Grotesk", stack: '"Space Grotesk", system-ui, sans-serif' },
  { id: "JetBrains Mono", label: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, monospace' },
  { id: "system", label: "System default", stack: "system-ui, -apple-system, sans-serif" },
] as const;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const row = await db.settings.get("app");
        if (row) setSettings({ ...defaultSettings, ...row });
        else await db.settings.put({ ...defaultSettings, id: "app" });
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Apply CSS vars when settings change
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const fontStack = FONT_OPTIONS.find((f) => f.id === settings.fontFamily)?.stack ?? FONT_OPTIONS[0].stack;
    root.style.setProperty("--font-sans", fontStack);
    root.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontFamily, settings.fontSize]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch, id: "app" as const };
    setSettings(next);
    await db.settings.put(next);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}
