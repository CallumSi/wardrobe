import { NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await readSettings());
}

export async function PUT(req: Request) {
  const body = await req.json();
  const settings = {
    climate: String(body.climate ?? ""),
    budget: String(body.budget ?? ""),
    preferredBrands: Array.isArray(body.preferredBrands)
      ? [
          ...new Set<string>(
            body.preferredBrands.map((b: unknown) => String(b).trim()).filter((s: string) => s.length > 0),
          ),
        ]
      : [],
    anthropicApiKey: String(body.anthropicApiKey ?? "").trim(),
  };
  await writeSettings(settings);
  return NextResponse.json(settings);
}
