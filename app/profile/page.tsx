"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildProfile, MIN_ITEMS_FOR_PROFILE } from "@/lib/analysis";
import type { Item } from "@/lib/constants";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <span className="score-track" role="img" aria-label={`${label}: ${value} out of 10`}>
        <span className="score-fill" style={{ width: `${value * 10}%` }} />
      </span>
      <span className="score-val mono">{value.toFixed(1)}</span>
    </div>
  );
}

export default function ProfilePage() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch("/api/items").then((r) => r.json()).then(setItems);
  }, []);

  const profile = useMemo(() => (items ? buildProfile(items) : null), [items]);

  if (items === null) return <p className="page-count">Reading the wardrobe…</p>;

  if (!profile) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">Style Profile</h1>
        </div>
        <div className="empty">
          <h2>No garments to read yet</h2>
          <p>The profile is computed live from your inventory. Log a few pieces and come back.</p>
          <Link href="/" className="btn" style={{ textDecoration: "none" }}>Go to inventory</Link>
        </div>
      </>
    );
  }

  const { scores, essentials } = profile;
  const missing = essentials.filter((e) => !e.matchedBy);
  const colourTotal = profile.colours.reduce((a, c) => a + c.count, 0) || 1;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Style Profile</h1>
        <span className="page-count">read from {profile.itemCount} garment{profile.itemCount === 1 ? "" : "s"}</span>
      </div>

      {!profile.ready && (
        <div className="notice">
          <strong>Early read.</strong> With fewer than {MIN_ITEMS_FOR_PROFILE} garments these numbers
          are provisional — every item you add sharpens them.
        </div>
      )}
      {profile.ready && !profile.solid && (
        <div className="notice">
          Reasonable first read — it firms up at around 10+ garments.
        </div>
      )}

      <div className="profile-grid">
        <section className="panel score-hero">
          <h2 className="panel-title">Wardrobe score</h2>
          <div className="overall">
            <span className="overall-num">{scores.overall}</span>
            <span className="overall-denom mono">/ 100</span>
          </div>
          <div className="subscores">
            <ScoreBar label="Versatility" value={scores.versatility} />
            <ScoreBar label="Balance" value={scores.balance} />
            <ScoreBar label="Quality" value={scores.quality} />
            <ScoreBar label="Colour harmony" value={scores.colourHarmony} />
            <ScoreBar label="Consistency" value={scores.consistency} />
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Aesthetic mix</h2>
          <div className="subscores">
            {profile.aesthetics.map((a) => (
              <div className="score-row" key={a.name}>
                <span className="score-label">{a.name}</span>
                <span className="score-track">
                  <span className="score-fill" style={{ width: `${a.pct}%` }} />
                </span>
                <span className="score-val mono">{a.pct}%</span>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Signals: brands, cuts, fabrics and colour discipline across the inventory.
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">Colour palette</h2>
          <div className="palette-strip" role="img" aria-label="Colour distribution">
            {profile.colours.map((c) => (
              <span
                key={c.name}
                className="palette-seg"
                style={{ background: c.hex, flexGrow: c.count }}
                title={`${c.name} ×${c.count}`}
              />
            ))}
          </div>
          <ul className="palette-legend">
            {profile.colours.slice(0, 6).map((c) => (
              <li key={c.name}>
                <span className="dot" style={{ background: c.hex }} />
                {c.name} <span className="mono legend-count">{Math.round((c.count / colourTotal) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="fine-print">{profile.neutralShare}% neutrals · {profile.basicsShare}% basics · {profile.allSeasonShare}% all-season</p>
        </section>

        <section className="panel">
          <h2 className="panel-title">Wardrobe shape</h2>
          <div className="subscores">
            {profile.categoryCounts.map((c) => (
              <div className="score-row" key={c.label}>
                <span className="score-label">{c.label}</span>
                <span className="score-track">
                  <span className="score-fill score-fill-ink" style={{ width: `${(c.count / profile.itemCount) * 100}%` }} />
                </span>
                <span className="score-val mono">{c.count}</span>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Formality range {profile.formalityMin}–{profile.formalityMax} (avg {profile.formalityAvg}) ·
            season coverage: {profile.seasonCoverage.map((s) => `${s.season.slice(0, 2)} ${s.count}`).join(" / ")}
          </p>
        </section>

        <section className="panel panel-span">
          <h2 className="panel-title">
            Essentials checklist
            <span className="mono-note">{essentials.length - missing.length} of {essentials.length} covered</span>
          </h2>
          <ul className="essentials">
            {essentials.map((e) => (
              <li key={e.label} className={e.matchedBy ? "essential-have" : "essential-missing"}>
                <span className="essential-mark mono">{e.matchedBy ? "✓" : "○"}</span>
                <span className="essential-body">
                  <span className="essential-label">{e.label}</span>
                  <span className="essential-hint">
                    {e.matchedBy ? `covered by ${e.matchedBy}` : e.hint}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {profile.observations.length > 0 && (
          <section className="panel panel-span">
            <h2 className="panel-title">Stylist’s notes</h2>
            <ul className="observations">
              {profile.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <p className="fine-print" style={{ marginTop: 18 }}>
        Computed live from the inventory each visit — nothing here is stored or edited by hand.
      </p>
    </>
  );
}
