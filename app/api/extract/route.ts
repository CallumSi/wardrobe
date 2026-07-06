import { NextResponse } from "next/server";
import { AUTH_HELP, extractGarment, fetchPageText, isAuthError } from "@/lib/ai";

export const maxDuration = 120;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function POST(req: Request) {
  const body = await req.json();
  const url: string | undefined = body.url?.trim() || undefined;
  const description: string | undefined = body.description?.trim() || undefined;
  const image = body.image as { data: string; mediaType: string } | undefined;

  if (!url && !description && !image) {
    return NextResponse.json(
      { error: "Provide a product URL, a description, or a photo." },
      { status: 400 },
    );
  }
  if (image && !IMAGE_TYPES.includes(image.mediaType as (typeof IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: "Unsupported image type — use JPEG, PNG, WebP or GIF." },
      { status: 400 },
    );
  }

  let pageText: string | undefined;
  let pageFetchFailed = false;
  if (url) {
    try {
      pageText = await fetchPageText(url);
    } catch {
      pageFetchFailed = true; // some shops block scraping — continue with whatever else we have
    }
  }

  if (pageFetchFailed && !description && !image) {
    return NextResponse.json(
      {
        error:
          "Couldn't read that product page (the shop may block automated access). Paste the product description or add a photo instead.",
      },
      { status: 422 },
    );
  }

  try {
    const extracted = await extractGarment({
      pageText,
      sourceUrl: url,
      description,
      image: image as Parameters<typeof extractGarment>[0]["image"],
    });
    return NextResponse.json({ extracted, pageFetchFailed });
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ error: AUTH_HELP, authError: true }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed." },
      { status: 500 },
    );
  }
}
