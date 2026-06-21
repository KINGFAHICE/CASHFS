import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ShieldCheck, Building2, Type, Save, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSettings, FONT_OPTIONS } from "@/lib/settings-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sounds } from "@/lib/sounds";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

import { centerCropSquare, fileToDataUrl } from "@/lib/image";

function SettingsPage() {
  const { isAdmin, isLoading } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [fontFamily, setFontFamily] = useState(settings.fontFamily);
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [logo, setLogo] = useState<string | undefined>(settings.businessLogo);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Only admins can change settings.</p>
        </div>
      </div>
    );
  }

  const handleLogo = async (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      sounds.error();
      alert("Logo must be under 5 MB");
      return;
    }
    try {
      const raw = await fileToDataUrl(f);
      const cropped = await centerCropSquare(raw, 256, 0.92);
      setLogo(cropped);
      sounds.click();
    } catch (e) {
      sounds.error();
      console.error(e);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        businessName: businessName.trim() || "POS Pro",
        businessLogo: logo,
        fontFamily,
        fontSize,
      });
      sounds.success();
      setSavedAt(Date.now());
    } catch (e) {
      console.error(e);
      sounds.error();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-display">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customise the app for your business — only admins can change these.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <header className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Business Identity</h2>
        </header>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Business Name</label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Kampala Electronics Hub" />
          <p className="text-xs text-muted-foreground mt-1">Shown in the top-right header and on receipts. The sidebar shows the software brand (BHM POS PRO).</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
              {logo ? (
                <img src={logo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              {logo && (
                <Button variant="ghost" size="sm" onClick={() => setLogo(undefined)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Remove
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">Auto center-cropped to a square and resized. Under 5 MB.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <header className="flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Typography</h2>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Font Family</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Base Font Size: {fontSize}px</label>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Scales the entire interface.</p>
          </div>
        </div>
        <div className="rounded-md border border-dashed border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Preview</p>
          <p style={{ fontFamily: FONT_OPTIONS.find((f) => f.id === fontFamily)?.stack, fontSize: `${fontSize}px` }}>
            The quick brown fox jumps over the lazy dog — UGX 1,234,567
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {savedAt && Date.now() - savedAt < 3000 && (
          <span className="text-sm text-profit">Saved · changes apply instantly.</span>
        )}
      </div>
    </div>
  );
}
