"use client";

import { useEffect, useRef, useState } from "react";
import { BUDGETS, CLIMATES, DEFAULT_BRANDS, type Settings } from "@/lib/constants";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newBrand, setNewBrand] = useState("");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const brandInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  if (!settings) {
    return <p className="page-count">Loading preferences…</p>;
  }

  const update = (patch: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    setStatus("dirty");
  };

  const addBrand = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (settings.preferredBrands.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      setNewBrand("");
      return;
    }
    update({ preferredBrands: [...settings.preferredBrands, clean] });
    setNewBrand("");
    brandInput.current?.focus();
  };

  const removeBrand = (name: string) =>
    update({ preferredBrands: settings.preferredBrands.filter((b) => b !== name) });

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setStatus(res.ok ? "saved" : "dirty");
  }

  const suggestions = DEFAULT_BRANDS.filter(
    (b) => !settings.preferredBrands.some((p) => p.toLowerCase() === b.toLowerCase()),
  );

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Settings</h1>
        <span className="page-count">shapes every recommendation</span>
      </div>

      <div className="settings-stack">
        <section className="panel">
          <h2 className="panel-title">Climate</h2>
          <div className="field" style={{ maxWidth: 380 }}>
            <label htmlFor="s-climate">Where you live and dress for</label>
            <select
              id="s-climate"
              value={settings.climate}
              onChange={(e) => update({ climate: e.target.value })}
            >
              <option value="">Not set</option>
              {CLIMATES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Budget per item</h2>
          <div className="seg-row" role="radiogroup" aria-label="Budget level">
            {BUDGETS.map((b) => (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={settings.budget === b.value}
                className={`seg${settings.budget === b.value ? " seg-active" : ""}`}
                onClick={() => update({ budget: b.value })}
              >
                <span className="seg-label">{b.label}</span>
                <span className="seg-hint">{b.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">
            Preferred brands
            <span className="mono-note">used for shopping recommendations</span>
          </h2>
          <div className="brand-chips">
            {settings.preferredBrands.map((b) => (
              <span key={b} className="brand-chip">
                {b}
                <button aria-label={`Remove ${b}`} onClick={() => removeBrand(b)}>✕</button>
              </span>
            ))}
            {settings.preferredBrands.length === 0 && (
              <span className="save-note">No brands yet — add some below.</span>
            )}
          </div>
          <form
            className="brand-add"
            onSubmit={(e) => { e.preventDefault(); addBrand(newBrand); }}
          >
            <input
              ref={brandInput}
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Add a brand…"
              aria-label="Add a brand"
            />
            <button className="btn btn-ghost" type="submit">Add</button>
          </form>
          {suggestions.length > 0 && (
            <div className="suggest-row">
              <span className="suggest-label">Suggestions</span>
              {suggestions.map((b) => (
                <button key={b} type="button" className="chip" onClick={() => addBrand(b)}>
                  + {b}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">
            AI
            <span className="mono-note">powers smart add and shopping recommendations</span>
          </h2>
          <p className="fine-print" style={{ margin: "0 0 14px" }}>
            No setup needed if Claude Code is installed and logged in on this machine — AI features
            run on your Claude subscription automatically.
          </p>
          <div className="field" style={{ maxWidth: 420 }}>
            <label htmlFor="s-apikey">Anthropic API key (optional)</label>
            <input
              id="s-apikey"
              type="password"
              value={settings.anthropicApiKey ?? ""}
              onChange={(e) => update({ anthropicApiKey: e.target.value })}
              placeholder="Leave blank to use your Claude subscription"
              autoComplete="off"
            />
          </div>
          <p className="fine-print">
            Only needed if you prefer direct API billing (console.anthropic.com) or don&apos;t have
            Claude Code. Stored locally in wardrobe/settings.json.
          </p>
        </section>

        <div className="save-bar">
          <button className="btn" onClick={save} disabled={status === "saving" || status === "idle" || status === "saved"}>
            {status === "saving" ? "Saving…" : "Save preferences"}
          </button>
          {status === "saved" && <span className="save-note saved">Preferences saved</span>}
          {status === "dirty" && <span className="save-note">Unsaved changes</span>}
        </div>
      </div>
    </>
  );
}
