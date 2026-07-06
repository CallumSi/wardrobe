"use client";

import { useState } from "react";
import { CATEGORIES, FITS, SEASONS, type Item } from "@/lib/constants";

export interface ItemDraft {
  category: string;
  subcategory: string;
  brand: string;
  colour: string[];
  material: string;
  fit: string;
  formality: number;
  season: string[];
  statementOrBasic: "basic" | "statement";
  notes: string;
}

function toDraft(item?: Item, initial?: Partial<ItemDraft>): ItemDraft {
  return {
    category: item?.category ?? initial?.category ?? "tops",
    subcategory: item?.subcategory ?? initial?.subcategory ?? "",
    brand: item?.brand ?? initial?.brand ?? "",
    colour: item?.colour ?? initial?.colour ?? [],
    material: item?.material ?? initial?.material ?? "",
    fit: item?.fit ?? initial?.fit ?? "Regular",
    formality: item?.formality ?? initial?.formality ?? 5,
    season: item?.season ?? initial?.season ?? ["All-season"],
    statementOrBasic: item?.statementOrBasic ?? initial?.statementOrBasic ?? "basic",
    notes: item?.notes ?? initial?.notes ?? "",
  };
}

export default function ItemForm({
  item,
  initial,
  banner,
  brands,
  onSubmit,
  onCancel,
}: {
  item?: Item;
  initial?: Partial<ItemDraft>;
  banner?: string;
  brands: string[];
  onSubmit: (draft: ItemDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(() => toDraft(item, initial));
  const [colourText, setColourText] = useState(
    (item?.colour ?? initial?.colour ?? []).join(", "),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleSeason = (s: string) =>
    set(
      "season",
      draft.season.includes(s) ? draft.season.filter((x) => x !== s) : [...draft.season, s],
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.subcategory.trim()) {
      setError("Give the item a name, e.g. “Overshirt” or “Straight-leg jeans”.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        ...draft,
        colour: colourText.split(",").map((c) => c.trim()).filter(Boolean),
      });
    } catch {
      setError("Couldn’t save the item. Check the dev server is running and try again.");
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="panel-title">
        {item ? `Edit ${item.id}` : "Add garment"}
        <span className="mono-note">fields marked * are required</span>
      </h2>
      {banner && <p className="form-banner">{banner}</p>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="f-category">Category *</label>
          <select
            id="f-category"
            value={draft.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sub">Item *</label>
          <input
            id="f-sub"
            value={draft.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
            placeholder="e.g. Crew-neck tee"
          />
        </div>
        <div className="field">
          <label htmlFor="f-brand">Brand</label>
          <input
            id="f-brand"
            value={draft.brand}
            onChange={(e) => set("brand", e.target.value)}
            list="brand-options"
            placeholder="e.g. Uniqlo"
          />
          <datalist id="brand-options">
            {brands.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="f-colour">Colours (comma-separated)</label>
          <input
            id="f-colour"
            value={colourText}
            onChange={(e) => setColourText(e.target.value)}
            placeholder="e.g. navy, off-white"
          />
        </div>
        <div className="field">
          <label htmlFor="f-material">Material</label>
          <input
            id="f-material"
            value={draft.material}
            onChange={(e) => set("material", e.target.value)}
            placeholder="e.g. heavyweight cotton"
          />
        </div>
        <div className="field">
          <label htmlFor="f-fit">Fit</label>
          <select id="f-fit" value={draft.fit} onChange={(e) => set("fit", e.target.value)}>
            {FITS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-formality">Formality — 1 casual · 10 black tie</label>
          <div className="range-row">
            <input
              id="f-formality"
              type="range"
              min={1}
              max={10}
              value={draft.formality}
              onChange={(e) => set("formality", Number(e.target.value))}
            />
            <span className="range-val mono">{draft.formality}</span>
          </div>
        </div>
        <div className="field">
          <label>Type</label>
          <div className="check-row">
            {(["basic", "statement"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`chip${draft.statementOrBasic === t ? " chip-active" : ""}`}
                onClick={() => set("statementOrBasic", t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="field field-wide">
          <label>Seasons</label>
          <div className="check-row">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${draft.season.includes(s) ? " chip-active" : ""}`}
                onClick={() => toggleSeason(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="field field-wide">
          <label htmlFor="f-notes">Notes</label>
          <textarea
            id="f-notes"
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything worth remembering — fit quirks, where you wear it, condition"
          />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : item ? "Save changes" : "Add to wardrobe"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        {error && <span className="form-error">{error}</span>}
      </div>
    </form>
  );
}
