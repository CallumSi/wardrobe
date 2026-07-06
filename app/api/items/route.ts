import { NextResponse } from "next/server";
import { addItem, listItems } from "@/lib/store";
import { CATEGORIES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json(await listItems());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!CATEGORIES.some((c) => c.value === body.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (!body.subcategory?.trim()) {
    return NextResponse.json({ error: "Subcategory is required" }, { status: 400 });
  }
  const item = await addItem({
    category: body.category,
    subcategory: String(body.subcategory).trim(),
    brand: String(body.brand ?? "").trim(),
    colour: Array.isArray(body.colour) ? body.colour : [],
    pattern: body.pattern || undefined,
    material: body.material || undefined,
    fit: body.fit || undefined,
    formality: Math.min(10, Math.max(1, Number(body.formality) || 5)),
    season: Array.isArray(body.season) ? body.season : [],
    statementOrBasic: body.statementOrBasic === "statement" ? "statement" : "basic",
    notes: body.notes || undefined,
  });
  return NextResponse.json(item, { status: 201 });
}
