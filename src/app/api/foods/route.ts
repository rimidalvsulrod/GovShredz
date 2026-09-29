import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireUser, rateLimit } from "@/lib/auth";
import { searchFoods, type Food } from "@/shared/foods";

type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const n = (v: unknown) => {
  const x = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return isFinite(x) ? Math.round(x * 10) / 10 : NaN;
};

/** Packaged foods from Open Food Facts (free, no key). Per serving when known, else per 100 g. */
async function searchOnline(q: string): Promise<Food[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,serving_size,nutriments`;
  const res = await fetch(url, { headers: { "User-Agent": "GovShredz/1.0 (fitness tracker)" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: OffProduct[] };
  const out: Food[] = [];
  for (const p of data.products ?? []) {
    const name = p.product_name?.trim();
    const nm = p.nutriments ?? {};
    if (!name) continue;
    const perServing = isFinite(n(nm["energy-kcal_serving"])) && p.serving_size;
    const kcal = perServing ? n(nm["energy-kcal_serving"]) : n(nm["energy-kcal_100g"]);
    if (!isFinite(kcal)) continue;
    const pick = (k: string) => {
      const v = perServing ? n(nm[`${k}_serving`]) : n(nm[`${k}_100g`]);
      return isFinite(v) ? v : 0;
    };
    out.push({
      name,
      brand: p.brands?.split(",")[0]?.trim() || undefined,
      serving: perServing ? p.serving_size!.slice(0, 40) : "100 g",
      kcal,
      protein: pick("proteins"),
      carbs: pick("carbohydrates"),
      fat: pick("fat"),
    });
  }
  return out;
}

export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ foods: [], online: [] });
  const foods = searchFoods(q);
  let online: Food[] = [];
  if (req.nextUrl.searchParams.get("online") !== "0" && (await rateLimit(`foods:${auth.user.id}`, 30, 60))) {
    online = await searchOnline(q).catch(() => []);
  }
  return Response.json({ foods, online });
});
