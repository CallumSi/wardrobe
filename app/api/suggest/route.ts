import { NextResponse } from "next/server";
import { AUTH_HELP, isAuthError, suggestPurchases } from "@/lib/ai";
import { listItems, readRecommendations, readSettings, writeRecommendations } from "@/lib/store";
import { buildProfile } from "@/lib/analysis";

export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(await readRecommendations());
}

export async function POST() {
  const [items, settings] = await Promise.all([listItems(), readSettings()]);
  if (items.length < 3) {
    return NextResponse.json(
      { error: "Log at least 3 garments first — recommendations need a wardrobe to work from." },
      { status: 400 },
    );
  }

  const profile = buildProfile(items)!;
  const missing = profile.essentials.filter((e) => !e.matchedBy);

  const context = [
    `CLIENT SETTINGS`,
    `Climate: ${settings.climate || "unknown"}`,
    `Budget per item: ${settings.budget || "unknown"}`,
    `Preferred brands: ${settings.preferredBrands.join(", ") || "none specified"}`,
    ``,
    `STYLE PROFILE (computed)`,
    `Aesthetic mix: ${profile.aesthetics.map((a) => `${a.name} ${a.pct}%`).join(", ")}`,
    `Palette: ${profile.colours.slice(0, 8).map((c) => `${c.name}×${c.count}`).join(", ")} (${profile.neutralShare}% neutrals)`,
    `Missing essentials: ${missing.map((m) => m.label).join("; ") || "none"}`,
    `Observations: ${profile.observations.join(" ")}`,
    ``,
    `WARDROBE INVENTORY (${items.length} items)`,
    ...items.map(
      (i) =>
        `${i.id}: ${i.brand} ${i.subcategory} — ${i.colour.join("/")}, ${i.material ?? "?"}, ${i.fit ?? "?"} fit, formality ${i.formality}/10, ${i.season.join("/")}, ${i.statementOrBasic}`,
    ),
  ].join("\n");

  try {
    const recommendations = await suggestPurchases(context);
    const file = await writeRecommendations(recommendations);
    return NextResponse.json(file);
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ error: AUTH_HELP, authError: true }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recommendation run failed." },
      { status: 500 },
    );
  }
}
