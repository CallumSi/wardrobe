import { CATEGORIES, swatch, type Item } from "./constants";

// Everything here is a deterministic heuristic over the inventory. It gives a
// live, explainable read — the stylist refines the narrative over time.

export const MIN_ITEMS_FOR_PROFILE = 5;
export const SOLID_READ_ITEMS = 10;

const NEUTRALS = new Set([
  "black", "white", "off-white", "ecru", "cream", "ivory", "beige", "stone",
  "sand", "tan", "camel", "brown", "chocolate", "taupe", "grey", "gray",
  "light grey", "charcoal", "navy",
]);

const QUALITY_TIERS: [number, string[]][] = [
  [10, ["acne studios", "our legacy", "a.p.c.", "apc", "aimé leon dore", "aime leon dore", "stone island", "margaret howell"]],
  [8, ["cos", "norse projects", "sunspel", "asket", "massimo dutti", "carhartt wip", "carhartt", "new balance", "oliver spencer"]],
  [6, ["arket", "weekday", "adidas", "nike", "muji", "lululemon"]],
  [5, ["uniqlo", "zara", "h&m", "hm", "primark", "shein"]],
];

const QUALITY_MATERIALS = ["wool", "cashmere", "merino", "lambswool", "linen", "leather", "suede", "selvedge", "silk"];

interface AestheticRule {
  name: string;
  score: (item: Item, text: string) => number;
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

const AESTHETIC_RULES: AestheticRule[] = [
  {
    name: "Modern Minimalism",
    score: (item, t) => {
      let s = 0;
      if (has(t, "cos", "asket", "muji", "uniqlo")) s += 2;
      if (item.colour.length > 0 && item.colour.every((c) => NEUTRALS.has(c.toLowerCase()))) s += 1;
      if (item.statementOrBasic === "basic") s += 0.5;
      return s;
    },
  },
  {
    name: "Scandinavian",
    score: (_item, t) =>
      has(t, "arket", "weekday", "norse projects", "acne", "our legacy") ? 2.5 : 0,
  },
  {
    name: "Streetwear",
    score: (item, t) => {
      let s = 0;
      if (has(t, "nike", "adidas", "new balance", "stüssy", "stussy", "supreme", "palace")) s += 1.5;
      if (has(t, "hoodie", "graphic", "cap", "sneaker", "cargo", "track")) s += 1.5;
      if (item.fit === "Oversized" || item.fit === "Boxy") s += 1;
      return s;
    },
  },
  {
    name: "Workwear",
    score: (_item, t) => {
      let s = 0;
      if (has(t, "carhartt")) s += 2;
      if (has(t, "chore", "canvas", "duck", "carpenter", "work pant", "overshirt", "denim jacket", "fatigue")) s += 2;
      return s;
    },
  },
  {
    name: "Classic Menswear",
    score: (item, t) => {
      let s = 0;
      if (has(t, "blazer", "loafer", "oxford", "derby", "chino", "trench", "overcoat", "shirt", "trouser")) s += 1.5;
      if (item.formality >= 6) s += 1;
      if (item.fit === "Tailored") s += 1;
      if (has(t, "massimo dutti")) s += 1;
      return s;
    },
  },
  {
    name: "Quiet Luxury",
    score: (item, t) => {
      let s = 0;
      if (has(t, "cashmere", "merino", "lambswool", "silk", "suede")) s += 2;
      if (has(t, "sunspel", "a.p.c.", "apc", "our legacy", "acne studios", "aimé leon dore", "aime leon dore")) s += 1.5;
      if (item.statementOrBasic === "basic" && item.formality >= 5) s += 0.5;
      return s;
    },
  },
  {
    name: "Athletic / Sport",
    score: (item, t) => {
      let s = 0;
      if (item.category === "athletic") s += 2.5;
      if (has(t, "lululemon", "running", "gym", "technical", "gore-tex")) s += 1;
      return s;
    },
  },
  {
    name: "Vintage",
    score: (_item, t) => (has(t, "vintage", "second-hand", "secondhand", "thrift", "archive") ? 2 : 0),
  },
];

export interface Essential {
  label: string;
  hint: string;
  matchedBy: string | null;
}

const ESSENTIALS: { label: string; hint: string; test: (item: Item, text: string) => boolean }[] = [
  {
    label: "Plain light tee",
    hint: "white / off-white crew neck — the universal base layer",
    test: (i, t) => has(t, "tee", "t-shirt", "tshirt") && i.colour.some((c) => ["white", "off-white", "ecru", "cream"].includes(c.toLowerCase())),
  },
  {
    label: "Dark denim",
    hint: "navy / indigo / black jeans — anchors half of casual dressing",
    test: (i, t) => has(t, "jeans", "denim") && i.category !== "outerwear" && i.colour.some((c) => ["navy", "indigo", "black", "denim", "blue"].includes(c.toLowerCase())),
  },
  {
    label: "Smart trouser or chino",
    hint: "bridges casual and smart-casual",
    test: (_i, t) => has(t, "chino", "trouser", "pleated", "wool pant"),
  },
  {
    label: "Plain knitwear",
    hint: "crew or roll neck jumper — winter's most versatile layer",
    test: (_i, t) => has(t, "jumper", "sweater", "knit", "merino", "cardigan", "roll neck", "crewneck knit"),
  },
  {
    label: "Overshirt / light jacket",
    hint: "the spring–autumn outer layer",
    test: (i, t) => has(t, "overshirt", "chore", "harrington", "bomber", "denim jacket", "shacket") || (i.category === "outerwear" && i.season.some((s) => ["Spring", "Autumn"].includes(s))),
  },
  {
    label: "Proper winter coat",
    hint: "wool overcoat, parka or down — cold-season anchor",
    test: (i, t) => has(t, "overcoat", "coat", "parka", "puffer", "down") && (i.category === "outerwear" || i.season.includes("Winter")),
  },
  {
    label: "Clean white-ish sneaker",
    hint: "goes with 80% of a casual wardrobe",
    test: (i, t) => (i.category === "shoes" || has(t, "sneaker", "trainer")) && i.colour.some((c) => ["white", "off-white", "cream", "grey", "gray"].includes(c.toLowerCase())),
  },
  {
    label: "Smart shoe or boot",
    hint: "loafers, derbies or leather boots for formality 6+",
    test: (i, t) => i.category === "shoes" && has(t, "loafer", "derby", "oxford", "boot", "leather"),
  },
  {
    label: "Proper shirt",
    hint: "oxford or poplin — smart-casual backbone",
    test: (i, t) => has(t, "oxford", "poplin", "shirt") && !has(t, "t-shirt", "tshirt", "overshirt") && i.category !== "outerwear",
  },
];

export interface Profile {
  itemCount: number;
  ready: boolean;
  solid: boolean;
  aesthetics: { name: string; pct: number }[];
  colours: { name: string; hex: string; count: number }[];
  neutralShare: number;
  basicsShare: number;
  allSeasonShare: number;
  formalityMin: number;
  formalityMax: number;
  formalityAvg: number;
  categoryCounts: { label: string; count: number }[];
  seasonCoverage: { season: string; count: number }[];
  scores: {
    versatility: number;
    balance: number;
    quality: number;
    colourHarmony: number;
    consistency: number;
    overall: number;
  };
  essentials: Essential[];
  observations: string[];
}

const clamp = (n: number, lo = 1, hi = 10) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildProfile(items: Item[]): Profile | null {
  if (items.length === 0) return null;
  const n = items.length;

  const itemText = (i: Item) =>
    `${i.brand} ${i.subcategory} ${i.material ?? ""} ${i.pattern ?? ""} ${i.notes ?? ""}`.toLowerCase();

  // — Aesthetics —
  const totals = new Map<string, number>();
  for (const item of items) {
    const t = itemText(item);
    for (const rule of AESTHETIC_RULES) {
      const s = rule.score(item, t);
      if (s > 0) totals.set(rule.name, (totals.get(rule.name) ?? 0) + s);
    }
  }
  let scored = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const signal = scored.reduce((acc, [, v]) => acc + v, 0);
  if (signal < n * 0.6)
    scored = [["Contemporary Casual", 1] as [string, number], ...scored].slice(0, 4);
  const signalTotal = scored.reduce((acc, [, v]) => acc + v, 0);
  const aesthetics = scored.map(([name, v]) => ({
    name,
    pct: Math.round((v / signalTotal) * 20) * 5,
  }));
  // Rounding to the nearest 5 can leave the mix short of (or over) 100 — settle
  // the difference on the dominant aesthetic.
  if (aesthetics.length > 0) {
    const sum = aesthetics.reduce((a, x) => a + x.pct, 0);
    aesthetics[0].pct += 100 - sum;
  }

  // — Colours —
  const colourMap = new Map<string, number>();
  for (const item of items)
    for (const c of item.colour) {
      const key = c.trim().toLowerCase();
      if (key) colourMap.set(key, (colourMap.get(key) ?? 0) + 1);
    }
  const colours = [...colourMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, hex: swatch(name), count }));
  const colourTotal = colours.reduce((a, c) => a + c.count, 0) || 1;
  const neutralShare = colours.filter((c) => NEUTRALS.has(c.name)).reduce((a, c) => a + c.count, 0) / colourTotal;

  // — Shape —
  const basicsShare = items.filter((i) => i.statementOrBasic === "basic").length / n;
  const allSeasonShare = items.filter((i) => i.season.includes("All-season")).length / n;
  const formalities = items.map((i) => i.formality);
  const categoryCounts = CATEGORIES.map((c) => ({
    label: c.label,
    count: items.filter((i) => i.category === c.value).length,
  })).filter((c) => c.count > 0);
  const seasonCoverage = ["Spring", "Summer", "Autumn", "Winter"].map((season) => ({
    season,
    count: items.filter((i) => i.season.includes(season) || i.season.includes("All-season")).length,
  }));

  // — Scores —
  const versatility = clamp(basicsShare * 4 + allSeasonShare * 3 + neutralShare * 3);

  const core = ["tops", "bottoms", "shoes", "outerwear"] as const;
  const coreCovered = core.filter((c) =>
    items.some((i) => i.category === c || (c === "tops" && i.category === "basics")),
  ).length;
  const maxCatShare = Math.max(...categoryCounts.map((c) => c.count)) / n;
  const balance = clamp(coreCovered * 2 + (maxCatShare <= 0.6 ? 2 : 0));

  const brandTier = (brand: string): number => {
    const b = brand.toLowerCase();
    for (const [tier, names] of QUALITY_TIERS) if (names.some((x) => b.includes(x))) return tier;
    return 6;
  };
  const materialBoost = items.filter((i) => has(itemText(i), ...QUALITY_MATERIALS)).length / n;
  const quality = clamp(items.reduce((a, i) => a + brandTier(i.brand), 0) / n + materialBoost * 1.5);

  const colourHarmony = clamp(10 - Math.max(0, colours.length - 4) * 0.8 - (neutralShare < 0.3 ? 1 : 0));

  const topShare = aesthetics.length > 0 ? aesthetics[0].pct / 100 : 0.5;
  const consistency = clamp(3 + topShare * 7);

  const overall = Math.round(
    ((versatility + balance + quality + colourHarmony + consistency) / 5) * 10,
  );

  // — Essentials —
  const essentials: Essential[] = ESSENTIALS.map((e) => {
    const match = items.find((i) => e.test(i, itemText(i)));
    return { label: e.label, hint: e.hint, matchedBy: match?.id ?? null };
  });

  // — Observations —
  const observations: string[] = [];
  if (colours.length > 0)
    observations.push(
      `Palette leads with ${colours.slice(0, 3).map((c) => c.name).join(", ")} — ${Math.round(neutralShare * 100)}% neutrals.`,
    );
  if (basicsShare >= 0.75)
    observations.push("Heavily basics-led: easy to combine, but could carry one or two more statement pieces.");
  if (basicsShare <= 0.4)
    observations.push("Statement-heavy: outfits risk competing focal points; more quiet basics would raise combinability.");
  const winter = seasonCoverage.find((s) => s.season === "Winter");
  if (winter && winter.count / n < 0.25)
    observations.push("Winter coverage is thin relative to the rest of the wardrobe.");
  const missing = essentials.filter((e) => !e.matchedBy).length;
  if (missing > 0)
    observations.push(`${missing} of ${essentials.length} core essentials are missing — see the checklist.`);

  return {
    itemCount: n,
    ready: n >= MIN_ITEMS_FOR_PROFILE,
    solid: n >= SOLID_READ_ITEMS,
    aesthetics,
    colours,
    neutralShare: round1(neutralShare * 100),
    basicsShare: round1(basicsShare * 100),
    allSeasonShare: round1(allSeasonShare * 100),
    formalityMin: Math.min(...formalities),
    formalityMax: Math.max(...formalities),
    formalityAvg: round1(formalities.reduce((a, b) => a + b, 0) / n),
    categoryCounts,
    seasonCoverage,
    scores: {
      versatility: round1(versatility),
      balance: round1(balance),
      quality: round1(quality),
      colourHarmony: round1(colourHarmony),
      consistency: round1(consistency),
      overall,
    },
    essentials,
    observations,
  };
}
