import { promises as fs } from "fs";
import os from "os";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { readSettings } from "./store";
import { cliAvailable, extractJson, runClaudeCli } from "./claudeCli";
import { CATEGORIES, FITS, SEASONS } from "./constants";

const MODEL = "claude-opus-4-8";

export class NoAiBackendError extends Error {
  constructor() {
    super("No AI backend available");
    this.name = "NoAiBackendError";
  }
}

export const AUTH_HELP =
  "No AI backend available. Either log into Claude Code on this machine (uses your Claude subscription), or add an Anthropic API key under Settings → AI.";

async function getApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return settings.anthropicApiKey?.trim() || process.env.ANTHROPIC_API_KEY || undefined;
}

export function isAuthError(err: unknown): boolean {
  return (
    err instanceof NoAiBackendError ||
    err instanceof Anthropic.AuthenticationError ||
    (err instanceof Error && /api key|x-api-key|authentication|logged in/i.test(err.message))
  );
}

// ——— Garment extraction ———

const categoryValues = CATEGORIES.map((c) => c.value) as [string, ...string[]];
const fitValues = FITS as unknown as [string, ...string[]];
const seasonValues = SEASONS as unknown as [string, ...string[]];

const ExtractedItemSchema = z.object({
  category: z.enum(categoryValues),
  subcategory: z.string().describe("Short item name, e.g. 'Overshirt' or 'Straight-leg jeans'"),
  brand: z.string().describe("Brand name, or empty string if unknown"),
  colour: z
    .array(z.string())
    .describe("Simple lowercase colour names, e.g. 'navy', 'off-white', 'olive'"),
  material: z.string().describe("Main fabric/material, or empty string if unknown"),
  fit: z.enum(fitValues),
  formality: z.number().describe("1 (beachwear) to 10 (black tie)"),
  season: z.array(z.enum(seasonValues)),
  statementOrBasic: z.enum(["basic", "statement"]),
  notes: z
    .string()
    .describe("One short useful sentence (fabric weight, fit quirks, styling), or empty string"),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

const EXTRACTION_INSTRUCTIONS = `You are a fashion archivist logging a garment into a personal wardrobe inventory.
From the provided material (product page text, a written description, and/or a photo), extract the garment's attributes.
If several products appear, pick the main/primary one. Guess sensibly where information is implicit
(e.g. a heavyweight flannel shirt is Autumn/Winter). Use empty strings rather than inventing brands or materials.`;

const EXTRACTION_JSON_SPEC = `Respond with ONLY a raw JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "category": one of ${categoryValues.map((v) => `"${v}"`).join(", ")},
  "subcategory": "short item name, e.g. Overshirt",
  "brand": "brand name or empty string",
  "colour": ["simple lowercase colour names"],
  "material": "main fabric or empty string",
  "fit": one of ${fitValues.map((v) => `"${v}"`).join(", ")},
  "formality": integer 1-10 (1 beachwear, 10 black tie),
  "season": array from ${seasonValues.map((v) => `"${v}"`).join(", ")},
  "statementOrBasic": "basic" or "statement",
  "notes": "one short useful sentence or empty string"
}`;

function normalizeExtracted(raw: unknown): ExtractedItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];
  const candidate = {
    category: String(o.category ?? ""),
    subcategory: String(o.subcategory ?? ""),
    brand: String(o.brand ?? ""),
    colour: arr(o.colour).map((c) => c.toLowerCase()),
    material: String(o.material ?? ""),
    fit: fitValues.includes(String(o.fit)) ? String(o.fit) : "Regular",
    formality: Math.min(10, Math.max(1, Math.round(Number(o.formality) || 5))),
    season: arr(o.season).filter((s) => seasonValues.includes(s)),
    statementOrBasic: o.statementOrBasic === "statement" ? "statement" : "basic",
    notes: String(o.notes ?? ""),
  };
  if (candidate.season.length === 0) candidate.season = ["All-season"];
  const parsed = ExtractedItemSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("The model reply didn't match the expected garment shape.");
  return parsed.data;
}

export async function extractGarment(input: {
  pageText?: string;
  sourceUrl?: string;
  description?: string;
  image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
}): Promise<ExtractedItem> {
  const parts: string[] = [EXTRACTION_INSTRUCTIONS];
  if (input.sourceUrl) parts.push(`Product URL: ${input.sourceUrl}`);
  if (input.pageText) parts.push(`Product page text (extracted from HTML):\n${input.pageText}`);
  if (input.description) parts.push(`Owner's description:\n${input.description}`);
  if (input.image && !input.pageText && !input.description)
    parts.push("Identify the garment in the photo.");

  const apiKey = await getApiKey();

  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const content: Anthropic.ContentBlockParam[] = [];
    if (input.image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: input.image.mediaType, data: input.image.data },
      });
    }
    content.push({ type: "text", text: parts.join("\n\n") });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(ExtractedItemSchema) },
    });
    if (!response.parsed_output) {
      throw new Error("The model could not extract a garment from that input.");
    }
    return normalizeExtracted(response.parsed_output);
  }

  // Claude Code CLI fallback — runs on the user's Claude subscription.
  if (!(await cliAvailable())) throw new NoAiBackendError();

  let imagePath: string | null = null;
  try {
    if (input.image) {
      const ext = input.image.mediaType.split("/")[1];
      imagePath = path.join(os.tmpdir(), `wardrobe-garment-${Date.now()}.${ext}`);
      await fs.writeFile(imagePath, Buffer.from(input.image.data, "base64"));
      parts.push(`A photo of the garment is saved at: ${imagePath} — read it with the Read tool.`);
    }
    parts.push(EXTRACTION_JSON_SPEC);
    const reply = await runClaudeCli(parts.join("\n\n"), {
      allowedTools: imagePath ? ["Read"] : [],
      timeoutMs: 240000,
    });
    return normalizeExtracted(extractJson(reply));
  } finally {
    if (imagePath) await fs.unlink(imagePath).catch(() => {});
  }
}

// ——— Batch extraction: many product URLs, one AI pass ———

const BatchExtractedSchema = z.object({
  items: z.array(ExtractedItemSchema.extend({ url: z.string() })),
});

const BATCH_JSON_SPEC = `Respond with ONLY a raw JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "items": [
    {
      "url": "the product URL this entry corresponds to",
      "category": one of ${categoryValues.map((v) => `"${v}"`).join(", ")},
      "subcategory": "short item name, e.g. Overshirt",
      "brand": "brand name or empty string",
      "colour": ["simple lowercase colour names"],
      "material": "main fabric or empty string",
      "fit": one of ${fitValues.map((v) => `"${v}"`).join(", ")},
      "formality": integer 1-10 (1 beachwear, 10 black tie),
      "season": array from ${seasonValues.map((v) => `"${v}"`).join(", ")},
      "statementOrBasic": "basic" or "statement",
      "notes": "one short useful sentence or empty string"
    }
  ]
}
Return exactly one entry per product, in the same order as given. If a product is truly unidentifiable, return it with an empty "subcategory".`;

export interface BatchEntryResult {
  url: string;
  ok: boolean;
  extracted?: ExtractedItem;
  error?: string;
  pageFetchFailed: boolean;
}

export async function extractGarmentsBatch(urls: string[]): Promise<BatchEntryResult[]> {
  const pages = await Promise.allSettled(urls.map((u) => fetchPageText(u)));
  const fetchFailed = pages.map((p) => p.status === "rejected");

  const productBlocks = urls.map((url, i) => {
    const page = pages[i];
    const body =
      page.status === "fulfilled"
        ? `Product page text:\n${page.value.slice(0, 8000)}`
        : "(page could not be fetched — infer what you can from the URL itself; brand and product names are often in the URL slug)";
    return `PRODUCT ${i + 1}\nURL: ${url}\n${body}`;
  });

  const prompt = [
    EXTRACTION_INSTRUCTIONS,
    `There are ${urls.length} products to log, listed below.`,
    ...productBlocks,
    BATCH_JSON_SPEC,
  ].join("\n\n———\n\n");

  const apiKey = await getApiKey();
  let rawItems: unknown[];

  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(BatchExtractedSchema) },
    });
    rawItems = response.parsed_output?.items ?? [];
  } else {
    if (!(await cliAvailable())) throw new NoAiBackendError();
    const reply = await runClaudeCli(prompt, { timeoutMs: 420000 });
    const parsed = extractJson(reply) as { items?: unknown[] };
    rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  }

  return urls.map((url, i) => {
    const raw =
      rawItems.find((it) => (it as { url?: string })?.url === url) ?? rawItems[i];
    if (!raw) {
      return { url, ok: false, error: "No extraction returned for this link.", pageFetchFailed: fetchFailed[i] };
    }
    try {
      const extracted = normalizeExtracted(raw);
      if (!extracted.subcategory.trim()) {
        return { url, ok: false, error: "Couldn't identify a garment from this link.", pageFetchFailed: fetchFailed[i] };
      }
      return { url, ok: true, extracted, pageFetchFailed: fetchFailed[i] };
    } catch (e) {
      return {
        url,
        ok: false,
        error: e instanceof Error ? e.message : "Extraction failed.",
        pageFetchFailed: fetchFailed[i],
      };
    }
  });
}

// ——— Product page fetching ———

export async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "en-GB,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Page returned HTTP ${res.status}`);
  const html = await res.text();

  const meta: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) meta.push(`Title: ${title.trim()}`);
  for (const prop of ["og:title", "og:description", "product:price:amount"]) {
    const m = html.match(
      new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    );
    if (m) meta.push(`${prop}: ${m[1]}`);
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#\d+;|&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

  return [meta.join("\n"), text].filter(Boolean).join("\n\n");
}

// ——— Shopping recommendations ———

const RecommendationSchema = z.object({
  productName: z.string(),
  brand: z.string(),
  price: z.string().describe("Price with currency as found, e.g. '£135'"),
  colour: z.string().describe("Recommended colourway"),
  url: z.string().describe("Exact product page URL"),
  retailer: z.string(),
  reason: z.string().describe("Why this improves the wardrobe — the gap it fills"),
  pairsWith: z.array(z.string()).describe("Owned item IDs this pairs with, e.g. ['TOP-001']"),
  priority: z.number().describe("1 (nice to have) to 5 (essential)"),
});

const RecommendationListSchema = z.object({
  recommendations: z.array(RecommendationSchema),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

const RESEARCH_TASK = `Task: identify the 4–6 HIGHEST-IMPACT additions to this wardrobe (fill missing essentials first; maximise new outfit combinations; never duplicate something already owned). For each addition, use web search to find ONE real, currently purchasable product:
- Prefer the client's preferred brands and stay near the budget level.
- Must be purchasable in the client's region (assume UK if climate says UK).
- Verify the product exists by fetching its product page where possible; give the EXACT product page URL, current price, and the colourway you recommend.
- If a preferred brand has nothing suitable, a comparable reputable retailer is fine.`;

const RECOMMENDATIONS_JSON_SPEC = `Respond with ONLY a raw JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "recommendations": [
    {
      "productName": "...",
      "brand": "...",
      "price": "£135",
      "colour": "recommended colourway",
      "url": "exact product page URL",
      "retailer": "...",
      "reason": "why this improves the wardrobe",
      "pairsWith": ["owned item IDs, e.g. TOP-001"],
      "priority": integer 1-5 (5 = essential)
    }
  ]
}
Drop any recommendation you couldn't find a real product URL for.`;

function normalizeRecommendations(raw: unknown): Recommendation[] {
  const o = (raw ?? {}) as { recommendations?: unknown[] };
  const list = Array.isArray(o.recommendations) ? o.recommendations : [];
  const recs: Recommendation[] = [];
  for (const entry of list) {
    const r = (entry ?? {}) as Record<string, unknown>;
    const candidate = {
      productName: String(r.productName ?? ""),
      brand: String(r.brand ?? ""),
      price: String(r.price ?? ""),
      colour: String(r.colour ?? ""),
      url: String(r.url ?? ""),
      retailer: String(r.retailer ?? ""),
      reason: String(r.reason ?? ""),
      pairsWith: Array.isArray(r.pairsWith) ? r.pairsWith.map(String) : [],
      priority: Math.min(5, Math.max(1, Math.round(Number(r.priority) || 3))),
    };
    if (!candidate.productName || !/^https?:\/\//.test(candidate.url)) continue;
    const parsed = RecommendationSchema.safeParse(candidate);
    if (parsed.success) recs.push(parsed.data);
  }
  return recs.sort((a, b) => b.priority - a.priority);
}

export async function suggestPurchases(context: string): Promise<Recommendation[]> {
  const preamble = `You are an expert personal stylist doing a shopping research task for a client.\n\n${context}\n\n${RESEARCH_TASK}`;
  const apiKey = await getApiKey();

  if (!apiKey) {
    // Claude Code CLI fallback — its own agent loop handles web search.
    if (!(await cliAvailable())) throw new NoAiBackendError();
    const reply = await runClaudeCli(`${preamble}\n\n${RECOMMENDATIONS_JSON_SPEC}`, {
      allowedTools: ["WebSearch", "WebFetch"],
      timeoutMs: 540000,
    });
    const recs = normalizeRecommendations(extractJson(reply));
    if (recs.length === 0) throw new Error("The research run found no usable products — try again.");
    return recs;
  }

  const client = new Anthropic({ apiKey });
  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 12 },
    { type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: 8 },
  ];

  let messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `${preamble}\n\nThen present each recommendation with: product name, brand, retailer, price, recommended colour, exact URL, why it improves this specific wardrobe, which owned item IDs it pairs with, and a priority from 5 (essential) to 1 (nice to have).`,
    },
  ];
  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    tools,
    messages,
  });

  // Server-side tools may pause the turn; resume up to 5 times.
  for (let i = 0; i < 5 && response.stop_reason === "pause_turn"; i++) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      tools,
      messages,
    });
  }

  const researchText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!researchText.trim()) throw new Error("Research step produced no results.");

  const structured = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Convert this stylist research into structured recommendations, keeping URLs and prices exactly as written. Drop any recommendation that has no product URL.\n\n${researchText}`,
      },
    ],
    output_config: { format: zodOutputFormat(RecommendationListSchema) },
  });

  return normalizeRecommendations(structured.parsed_output ?? {});
}
