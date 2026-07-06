"use client";

import { useRef, useState } from "react";
import type { ItemDraft } from "./ItemForm";

const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const CHUNK_SIZE = 8;

interface BatchRow {
  url: string;
  ok: boolean;
  extracted?: ItemDraft & Record<string, unknown>;
  error?: string;
  pageFetchFailed: boolean;
  checked: boolean;
}

export default function QuickAdd({
  onExtracted,
  onBatchAdd,
}: {
  onExtracted: (draft: Partial<ItemDraft>, note?: string) => void;
  onBatchAdd: (drafts: ItemDraft[]) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ data: string; mediaType: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<BatchRow[] | null>(null);
  const [addingBatch, setAddingBatch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File | undefined) {
    setError("");
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Photo is too large — keep it under 4.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      setImage({ data: base64, mediaType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setInput("");
    setImage(null);
    setBatch(null);
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyzeBatch(urls: string[]) {
    setBatch([]);
    let done = 0;
    for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
      const chunk = urls.slice(i, i + CHUNK_SIZE);
      setProgress(`Analyzing links ${done + 1}–${done + chunk.length} of ${urls.length}… (one AI pass per ${CHUNK_SIZE})`);
      const res = await fetch("/api/extract-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: chunk }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Batch analysis failed.");
        return;
      }
      const rows: BatchRow[] = body.results.map((r: Omit<BatchRow, "checked">) => ({
        ...r,
        checked: r.ok,
      }));
      setBatch((prev) => [...(prev ?? []), ...rows]);
      done += chunk.length;
    }
    setProgress("");
  }

  async function analyze() {
    const text = input.trim();
    const urls = [...new Set(text.split(/\s+/).filter((t) => /^https?:\/\/\S+$/i.test(t)))];

    if (!text && !image) {
      setError("Paste one or more product links, a description, or add a photo.");
      return;
    }

    setBusy(true);
    setError("");
    setBatch(null);
    try {
      if (urls.length > 1) {
        await analyzeBatch(urls);
        return;
      }

      const isUrl = urls.length === 1 && urls[0] === text;
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: isUrl ? text : undefined,
          description: isUrl ? undefined : text || undefined,
          image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Analysis failed.");
        return;
      }
      const e = body.extracted;
      onExtracted(
        {
          category: e.category,
          subcategory: e.subcategory,
          brand: e.brand,
          colour: e.colour,
          material: e.material,
          fit: e.fit,
          formality: e.formality,
          season: e.season,
          statementOrBasic: e.statementOrBasic,
          notes: e.notes,
        },
        body.pageFetchFailed
          ? "The shop blocked page access, so this was read from the URL alone — double-check the fields."
          : undefined,
      );
      reset();
    } catch {
      setError("Couldn't reach the server. Is the dev server still running?");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function addSelected() {
    if (!batch) return;
    const drafts = batch.filter((r) => r.checked && r.ok && r.extracted).map((r) => r.extracted!);
    if (drafts.length === 0) return;
    setAddingBatch(true);
    setError("");
    try {
      await onBatchAdd(drafts as ItemDraft[]);
      reset();
    } catch {
      setError("Some items couldn't be saved — check the inventory and try again.");
    } finally {
      setAddingBatch(false);
    }
  }

  const selectedCount = batch?.filter((r) => r.checked && r.ok).length ?? 0;

  return (
    <div className="panel quick-add">
      <h2 className="panel-title">
        Smart add
        <span className="mono-note">
          paste one or MANY links (one per line), a description, or a photo — AI fills the rest
        </span>
      </h2>
      <div className="quick-add-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"https://www.arket.com/…\nhttps://www.uniqlo.com/…\nhttps://www.carhartt-wip.com/…"}
          rows={3}
          disabled={busy || addingBatch}
        />
        <div className="quick-add-side">
          <label className="btn btn-ghost quick-file">
            {image ? `📷 ${image.name.slice(0, 18)}` : "+ Photo"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => pickImage(e.target.files?.[0])}
              hidden
            />
          </label>
          <button className="btn" onClick={analyze} disabled={busy || addingBatch}>
            {busy ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {progress && <p className="quick-progress mono">{progress}</p>}
      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}

      {batch && batch.length > 0 && (
        <div className="batch-review">
          <ul className="batch-list">
            {batch.map((row, i) => (
              <li key={row.url} className={`batch-row${row.ok ? "" : " batch-row-failed"}`}>
                <input
                  type="checkbox"
                  checked={row.checked}
                  disabled={!row.ok || addingBatch}
                  onChange={() =>
                    setBatch((prev) =>
                      prev!.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r)),
                    )
                  }
                  aria-label={`Include ${row.extracted?.subcategory ?? row.url}`}
                />
                <span className="batch-summary">
                  {row.ok && row.extracted ? (
                    <>
                      <strong>
                        {row.extracted.brand ? `${row.extracted.brand} ` : ""}
                        {row.extracted.subcategory}
                      </strong>{" "}
                      <span className="batch-meta">
                        {String(row.extracted.category)} · {(row.extracted.colour as string[]).join("/")}
                        {row.pageFetchFailed ? " · read from URL only — double-check" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong className="batch-fail">Failed</strong>{" "}
                      <span className="batch-meta">{row.error}</span>
                    </>
                  )}
                  <span className="batch-url">{row.url}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button className="btn" onClick={addSelected} disabled={selectedCount === 0 || addingBatch || busy}>
              {addingBatch ? "Adding…" : `Add ${selectedCount} to wardrobe`}
            </button>
            <button className="btn btn-ghost" onClick={reset} disabled={addingBatch}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
