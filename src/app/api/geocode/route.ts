import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMember } from "@/lib/supabase/server";

export type GeocodeResult = {
  label: string;
  place: string;
  countryCode: string | null;
  countryName: string | null;
  lat: number;
  lng: number;
};

/**
 * Пошук місця через Nominatim (безкоштовний геокодер OpenStreetMap).
 *
 * Запит іде через наш сервер, а не напряму з браузера, з двох причин:
 *   1) Nominatim вимагає осмислений User-Agent, який браузер підмінити не дасть;
 *   2) так координати й тексти пошуку не звʼязуються з IP вашого телефона.
 */
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "uk");

  let raw: NominatimItem[];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "nash-atlas/1.0 (private travel journal)" },
      // Однакові запити віддаються з кешу добу — і швидше, і ввічливіше
      // до безкоштовного сервісу.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return NextResponse.json([]);
    raw = (await res.json()) as NominatimItem[];
  } catch {
    return NextResponse.json([]);
  }

  const results: GeocodeResult[] = raw.map((item) => ({
    label: item.display_name,
    place: item.name || item.display_name.split(",")[0].trim(),
    countryCode: item.address?.country_code?.toUpperCase() ?? null,
    countryName: item.address?.country ?? null,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));

  return NextResponse.json(results);
}

type NominatimItem = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: { country_code?: string; country?: string };
};
