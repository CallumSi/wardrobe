"use client";

import { useEffect, useMemo, useState } from "react";
import ItemForm, { type ItemDraft } from "@/components/ItemForm";
import QuickAdd from "@/components/QuickAdd";
import { CATEGORIES, swatch, type Item } from "@/lib/constants";

export default function InventoryPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [prefill, setPrefill] = useState<Partial<ItemDraft> | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/items").then((r) => r.json()).then(setItems);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setBrands(s.preferredBrands ?? []));
  }, []);

  const shown = useMemo(
    () => (items ?? []).filter((i) => filter === "all" || i.category === filter),
    [items, filter],
  );

  const usedCategories = useMemo(
    () => new Set((items ?? []).map((i) => i.category)),
    [items],
  );

  async function createItem(draft: ItemDraft) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error("create failed");
    const item = await res.json();
    setItems((prev) => [...(prev ?? []), item]);
    setAdding(false);
    setPrefill(null);
    setPrefillNote(undefined);
  }

  async function createMany(drafts: ItemDraft[]) {
    const created: Item[] = [];
    for (const draft of drafts) {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) created.push(await res.json());
    }
    setItems((prev) => [...(prev ?? []), ...created]);
    setAdding(false);
    setPrefill(null);
    setPrefillNote(undefined);
    if (created.length < drafts.length) {
      throw new Error(`${drafts.length - created.length} item(s) failed to save`);
    }
  }

  async function saveEdit(draft: ItemDraft) {
    if (!editing) return;
    const res = await fetch(`/api/items/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error("update failed");
    const updated = await res.json();
    setItems((prev) => (prev ?? []).map((i) => (i.id === updated.id ? updated : i)));
    setEditing(null);
  }

  async function remove(item: Item) {
    if (!confirm(`Remove ${item.id} — ${item.brand} ${item.subcategory}?`)) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Inventory</h1>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="page-count">
            {items === null ? "loading…" : `${items.length} garment${items.length === 1 ? "" : "s"}`}
          </span>
          {!adding && !editing && (
            <button className="btn" onClick={() => setAdding(true)}>+ Add garment</button>
          )}
        </div>
      </div>

      {adding && (
        <>
          <QuickAdd
            onExtracted={(draft, note) => {
              setPrefill(draft);
              setPrefillNote(note);
            }}
            onBatchAdd={createMany}
          />
          <ItemForm
            key={prefill ? JSON.stringify(prefill) : "blank"}
            initial={prefill ?? undefined}
            banner={
              prefill
                ? prefillNote ?? "Filled in by AI — review the fields, then add to wardrobe."
                : undefined
            }
            brands={brands}
            onSubmit={createItem}
            onCancel={() => {
              setAdding(false);
              setPrefill(null);
              setPrefillNote(undefined);
            }}
          />
        </>
      )}
      {editing && (
        <ItemForm
          key={editing.id}
          item={editing}
          brands={brands}
          onSubmit={saveEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      {items !== null && items.length > 0 && (
        <div className="filter-rail" role="group" aria-label="Filter by category">
          <button
            className={`chip${filter === "all" ? " chip-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {CATEGORIES.filter((c) => usedCategories.has(c.value)).map((c) => (
            <button
              key={c.value}
              className={`chip${filter === c.value ? " chip-active" : ""}`}
              onClick={() => setFilter(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && !adding && (
        <div className="empty">
          <h2>Nothing on the rail yet</h2>
          <p>Log your first garment and the wardrobe starts building itself.</p>
          <button className="btn" onClick={() => setAdding(true)}>Add first garment</button>
        </div>
      )}

      <div className="card-grid">
        {shown.map((item) => (
          <article key={item.id} className="tag-card">
            <div className="tag-top">
              <span className="tag-id">
                {item.id} · <span className="tag-cat">{item.category}</span>
              </span>
              <span className="dots" aria-label={`Colours: ${item.colour.join(", ")}`}>
                {item.colour.slice(0, 4).map((c, i) => (
                  <span key={i} className="dot" style={{ background: swatch(c) }} title={c} />
                ))}
              </span>
            </div>
            <h3 className="tag-name">
              {item.brand ? `${item.brand} ` : ""}{item.subcategory}
            </h3>
            <p className="tag-spec">
              {[item.material, item.fit && `${item.fit} fit`, `formality ${item.formality}/10`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {item.notes && <p className="tag-notes">{item.notes}</p>}
            <div className="tag-foot">
              <span className="tag-seasons">
                {item.statementOrBasic === "statement" && (
                  <span className="statement-flag">statement · </span>
                )}
                {item.season.join(" / ") || "—"}
              </span>
              <span className="tag-actions">
                <button className="btn btn-ghost btn-small" onClick={() => { setAdding(false); setEditing(item); window.scrollTo({ top: 0 }); }}>
                  Edit
                </button>
                <button className="btn btn-danger btn-small" onClick={() => remove(item)}>
                  Remove
                </button>
              </span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
