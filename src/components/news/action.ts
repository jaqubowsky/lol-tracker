"use server";

import { z } from "zod";

const NewsItemSchema = z.object({
  uid: z.string(),
  title: z.string(),
  date: z.string(),
  categories: z.array(z.string()),
  description: z.string(),
  image: z.string(),
  url: z.string(),
});

const NewsResponseSchema = z.array(NewsItemSchema);

export type NewsItem = z.infer<typeof NewsItemSchema>;

const NEWS_URL = "https://data.rito.news/lol/pl-pl/news.json";

const PATCH_RE = /patch/i;
const TFT_RE = /\btft\b|teamfight\s*tactics/i;
const EXCLUDED_CATEGORIES = new Set(["Fabuła", "Media", "Merch", "Ogłoszenia", "Społeczność"]);

function normalizeAndFilter(items: NewsItem[]): NewsItem[] {
  return items
    .filter((item) => !item.categories.every((c) => EXCLUDED_CATEGORIES.has(c)))
    .map((item) => {
      const cats = item.categories.filter((c) => !EXCLUDED_CATEGORIES.has(c));
      if (PATCH_RE.test(item.title)) {
        const patchCat = TFT_RE.test(item.title) ? "Patch Notes TFT" : "Patch Notes";
        if (!cats.includes(patchCat)) {
          return { ...item, categories: [patchCat, ...cats] };
        }
      }
      return cats.length !== item.categories.length ? { ...item, categories: cats } : item;
    });
}

export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(NEWS_URL, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const parsed = NewsResponseSchema.safeParse(data);

    if (!parsed.success) return [];

    return normalizeAndFilter(parsed.data);
  } catch {
    return [];
  }
}
