export type Category =
  | "tops" | "bottoms" | "outerwear" | "shoes" | "accessories" | "bags"
  | "jewelry" | "tailoring" | "athletic" | "formalwear" | "basics";

export const CATEGORIES: { value: Category; label: string; prefix: string }[] = [
  { value: "tops", label: "Tops", prefix: "TOP" },
  { value: "bottoms", label: "Bottoms", prefix: "BTM" },
  { value: "outerwear", label: "Outerwear", prefix: "OUT" },
  { value: "shoes", label: "Shoes", prefix: "SHO" },
  { value: "accessories", label: "Accessories", prefix: "ACC" },
  { value: "bags", label: "Bags", prefix: "BAG" },
  { value: "jewelry", label: "Jewelry", prefix: "JWL" },
  { value: "tailoring", label: "Tailoring", prefix: "TLR" },
  { value: "athletic", label: "Athletic", prefix: "ATH" },
  { value: "formalwear", label: "Formalwear", prefix: "FRM" },
  { value: "basics", label: "Basics", prefix: "BSC" },
];

export const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Tailored", "Boxy"] as const;

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "All-season"] as const;

export const BUDGETS = [
  { value: "budget", label: "Budget", hint: "under £50 per item" },
  { value: "mid-range", label: "Mid-range", hint: "£50–150 per item" },
  { value: "premium", label: "Premium", hint: "£150–400 per item" },
  { value: "luxury", label: "Luxury", hint: "£400+ per item" },
] as const;

export const CLIMATES = [
  "Temperate (UK / North-West Europe)",
  "Four distinct seasons",
  "Cold, long winters",
  "Mediterranean",
  "Hot & humid",
  "Hot & dry",
] as const;

// Seed list — fully editable in Settings.
export const DEFAULT_BRANDS = [
  "COS", "ARKET", "Uniqlo", "Massimo Dutti", "Weekday", "Norse Projects",
  "Asket", "Sunspel", "A.P.C.", "Our Legacy", "Acne Studios", "Carhartt WIP",
  "New Balance", "Adidas", "Nike", "Aimé Leon Dore", "Muji", "Lululemon",
];

// Best-effort swatch colours for common garment colour names.
export const COLOUR_HEX: Record<string, string> = {
  black: "#1d1d1f", white: "#f5f4ef", "off-white": "#efeadd", ecru: "#e8dfc9",
  cream: "#ede3cb", ivory: "#f0e9d8", beige: "#d9c9a8", stone: "#c9c0ae",
  sand: "#d6c39a", tan: "#c8a06a", camel: "#b98a4e", brown: "#6b4a2f",
  chocolate: "#4a3122", taupe: "#a99a87", grey: "#9a9a98", gray: "#9a9a98",
  "light grey": "#c4c4c1", charcoal: "#44464a", navy: "#26324b",
  blue: "#3d5a92", "light blue": "#a6bdd8", indigo: "#3a4466", denim: "#5471a1",
  green: "#4c6650", olive: "#6a6b46", khaki: "#8a815c", forest: "#33503c",
  sage: "#a3ac93", red: "#a5372c", burgundy: "#6a2e35", rust: "#a55e3a",
  orange: "#c7712f", yellow: "#d3ab4a", mustard: "#b98d33", pink: "#d3a5a5",
  purple: "#6d5a80", lilac: "#b3a4c4", silver: "#c0c2c5", gold: "#b1913f",
};

export function swatch(name: string): string {
  return COLOUR_HEX[name.trim().toLowerCase()] ?? "#b0aca3";
}

export interface Item {
  id: string;
  category: Category;
  subcategory: string;
  brand: string;
  colour: string[];
  pattern?: string;
  material?: string;
  fit?: string;
  formality: number;
  season: string[];
  statementOrBasic: "basic" | "statement";
  notes?: string;
  addedAt: string;
}

export interface Settings {
  climate: string;
  budget: string;
  preferredBrands: string[];
  anthropicApiKey?: string;
}
