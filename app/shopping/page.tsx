"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Rec {
  productName: string;
  brand: string;
  price: string;
  colour: string;
  url: string;
  retailer: string;
  reason: string;
  pairsWith: string[];
  priority: number;
}

interface RecFile {
  generatedAt: string;
  recommendations: Rec[];
}

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`Priority ${n} of 5`}>
      {"★".repeat(n)}
      <span className="stars-off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function ShoppingPage() {
  const [recs, setRecs] = useState<RecFile | null | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/suggest").then((r) => r.json()).then(setRecs);
  }, []);

  async function generate() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/suggest", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Recommendation run failed.");
        return;
      }
      setRecs(body);
    } catch {
      setError("Couldn't reach the server. Is the dev server still running?");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Shopping</h1>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {recs?.generatedAt && (
            <span className="page-count">last run {recs.generatedAt}</span>
          )}
          <button className="btn" onClick={generate} disabled={running}>
            {running
              ? "Researching…"
              : recs?.recommendations?.length
                ? "Refresh recommendations"
                : "Find recommendations"}
          </button>
        </div>
      </div>

      {running && (
        <div className="notice">
          Researching live products against your wardrobe gaps, budget and preferred brands —
          this uses web search and typically takes one to two minutes. Leave this page open.
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}

      {recs === undefined && !running && <p className="page-count">Loading…</p>}

      {recs === null && !running && !error && (
        <div className="empty">
          <h2>No recommendations yet</h2>
          <p>
            I&apos;ll analyse your wardrobe gaps and find real, currently purchasable products —
            with links — from your preferred brands. Make sure your{" "}
            <Link href="/settings">settings</Link> (budget, climate, brands, API key) are right first.
          </p>
          <button className="btn" onClick={generate} disabled={running}>
            Find recommendations
          </button>
        </div>
      )}

      {recs?.recommendations && recs.recommendations.length > 0 && (
        <>
          <div className="rec-list">
            {recs.recommendations.map((r, i) => (
              <article key={i} className="tag-card rec-card">
                <div className="tag-top">
                  <Stars n={r.priority} />
                  <span className="tag-id">{r.price}</span>
                </div>
                <h3 className="tag-name">
                  {r.brand} {r.productName}
                </h3>
                <p className="tag-spec">
                  {r.colour} · {r.retailer}
                </p>
                <p className="rec-reason">{r.reason}</p>
                {r.pairsWith.length > 0 && (
                  <p className="tag-seasons">pairs with {r.pairsWith.join(", ")}</p>
                )}
                <div className="tag-foot">
                  <a className="btn btn-ghost btn-small" href={r.url} target="_blank" rel="noopener noreferrer">
                    View product ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="fine-print" style={{ marginTop: 18 }}>
            Found via live web search — prices and stock were correct at research time; verify on
            the retailer&apos;s page before buying.
          </p>
        </>
      )}
    </>
  );
}
