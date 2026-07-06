import { NextResponse } from "next/server";
import { AUTH_HELP, extractGarmentsBatch, isAuthError } from "@/lib/ai";

export const maxDuration = 600;

const MAX_URLS_PER_REQUEST = 10;

export async function POST(req: Request) {
  const body = await req.json();
  const urls: string[] = Array.isArray(body.urls)
    ? [
        ...new Set<string>(
          body.urls
            .map((u: unknown) => String(u).trim())
            .filter((u: string) => /^https?:\/\/\S+$/i.test(u)),
        ),
      ]
    : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: "No valid product URLs provided." }, { status: 400 });
  }
  if (urls.length > MAX_URLS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Send at most ${MAX_URLS_PER_REQUEST} links per request — the app batches larger lists automatically.` },
      { status: 400 },
    );
  }

  try {
    const results = await extractGarmentsBatch(urls);
    return NextResponse.json({ results });
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ error: AUTH_HELP, authError: true }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch extraction failed." },
      { status: 500 },
    );
  }
}
