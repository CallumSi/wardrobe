import { promises as fs } from "fs";
import path from "path";
import { CATEGORIES, DEFAULT_BRANDS, type Item, type Settings } from "./constants";

const WARDROBE_DIR = path.join(process.cwd(), "wardrobe");
const INVENTORY_PATH = path.join(WARDROBE_DIR, "inventory.json");
const SETTINGS_PATH = path.join(WARDROBE_DIR, "settings.json");

interface InventoryFile {
  meta: Record<string, unknown>;
  items: Item[];
  categories: Record<string, string[]>;
  [key: string]: unknown;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function readInventory(): Promise<InventoryFile> {
  const inv = await readJson<InventoryFile>(INVENTORY_PATH, {
    meta: { created: new Date().toISOString().slice(0, 10) },
    items: [],
    categories: {},
  });
  if (!Array.isArray(inv.items)) inv.items = [];
  return inv;
}

async function writeInventory(inv: InventoryFile): Promise<void> {
  inv.meta = {
    ...inv.meta,
    last_updated: new Date().toISOString().slice(0, 10),
    item_count: inv.items.length,
  };
  // Keep the per-category id index in sync so the file stays readable on its own.
  const categories: Record<string, string[]> = {};
  for (const { value } of CATEGORIES) categories[value] = [];
  for (const item of inv.items) (categories[item.category] ??= []).push(item.id);
  inv.categories = categories;
  await fs.mkdir(WARDROBE_DIR, { recursive: true });
  await fs.writeFile(INVENTORY_PATH, JSON.stringify(inv, null, 2) + "\n", "utf-8");
}

export async function listItems(): Promise<Item[]> {
  return (await readInventory()).items;
}

export async function addItem(data: Omit<Item, "id" | "addedAt">): Promise<Item> {
  const inv = await readInventory();
  const prefix = CATEGORIES.find((c) => c.value === data.category)?.prefix ?? "ITM";
  const taken = new Set(inv.items.map((i) => i.id));
  let n = 1;
  while (taken.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  const item: Item = {
    ...data,
    id: `${prefix}-${String(n).padStart(3, "0")}`,
    addedAt: new Date().toISOString().slice(0, 10),
  };
  inv.items.push(item);
  await writeInventory(inv);
  return item;
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<Item | null> {
  const inv = await readInventory();
  const idx = inv.items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  // id and addedAt are immutable.
  const { id: _id, addedAt: _addedAt, ...rest } = patch;
  inv.items[idx] = { ...inv.items[idx], ...rest };
  await writeInventory(inv);
  return inv.items[idx];
}

export async function deleteItem(id: string): Promise<boolean> {
  const inv = await readInventory();
  const before = inv.items.length;
  inv.items = inv.items.filter((i) => i.id !== id);
  if (inv.items.length === before) return false;
  await writeInventory(inv);
  return true;
}

export interface RecommendationsFile {
  generatedAt: string;
  recommendations: unknown[];
}

const RECS_PATH = path.join(WARDROBE_DIR, "recommendations.json");

export async function readRecommendations(): Promise<RecommendationsFile | null> {
  return readJson<RecommendationsFile | null>(RECS_PATH, null);
}

export async function writeRecommendations(recommendations: unknown[]): Promise<RecommendationsFile> {
  const file: RecommendationsFile = {
    generatedAt: new Date().toISOString().slice(0, 10),
    recommendations,
  };
  await fs.mkdir(WARDROBE_DIR, { recursive: true });
  await fs.writeFile(RECS_PATH, JSON.stringify(file, null, 2) + "\n", "utf-8");
  return file;
}

export async function readSettings(): Promise<Settings> {
  return readJson<Settings>(SETTINGS_PATH, {
    climate: "",
    budget: "",
    preferredBrands: DEFAULT_BRANDS,
  });
}

export async function writeSettings(settings: Settings): Promise<void> {
  await fs.mkdir(WARDROBE_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}
