/**
 * Пошук місць через Nominatim (безкоштовний геокодер OpenStreetMap).
 *
 * Живе окремо від route-хендлера, бо потрібен у двох місцях: у пошуку
 * з форми і в дії, що дотягує межі до вже створених подорожей.
 */

/**
 * Межі міста у форматі GeoJSON. Точки й лінії свідомо відкинуті:
 * зафарбувати можна лише площу, а Nominatim повертає для гір і пляжів
 * саме точку — у такому разі подорож просто лишиться без заливки.
 */
export type TripBoundary =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type GeocodeResult = {
  label: string;
  place: string;
  countryCode: string | null;
  countryName: string | null;
  lat: number;
  lng: number;
  boundary: TripBoundary | null;
};

/**
 * Nominatim віддає контури з точністю до метрів. Для мапи світу це
 * надлишок, який коштує сотні кілобайт на кожен рядок, тому просимо
 * спростити ще на його боці. Значення в градусах: 0.002° ≈ 200 м.
 */
const POLYGON_THRESHOLD = "0.002";

/**
 * Запобіжник для випадків, коли навіть спрощений контур велетенський
 * (умовна Аляска). Краще подорож без заливки, ніж мегабайт у базі
 * і в кожній відповіді сервера.
 */
const MAX_BOUNDARY_BYTES = 250_000;

/** Відкидає все, що не є полігоном, і все, що завелике. */
export function normalizeBoundary(input: unknown): TripBoundary | null {
  if (!input || typeof input !== "object") return null;

  const geometry = input as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    return null;
  }
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return null;
  }

  const boundary = {
    type: geometry.type,
    coordinates: geometry.coordinates,
  } as TripBoundary;

  return JSON.stringify(boundary).length > MAX_BOUNDARY_BYTES ? null : boundary;
}

export async function searchPlaces(q: string): Promise<GeocodeResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "uk");
  // Межі міста — те, чим зафарбовується мапа.
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("polygon_threshold", POLYGON_THRESHOLD);

  let raw: NominatimItem[];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "nash-atlas/1.0 (private travel journal)" },
      // Однакові запити віддаються з кешу добу — і швидше, і ввічливіше
      // до безкоштовного сервісу.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return [];
    raw = (await res.json()) as NominatimItem[];
  } catch {
    return [];
  }

  return raw.map((item) => ({
    label: item.display_name,
    place: item.name || item.display_name.split(",")[0].trim(),
    countryCode: item.address?.country_code?.toUpperCase() ?? null,
    countryName: item.address?.country ?? null,
    lat: Number(item.lat),
    lng: Number(item.lon),
    boundary: normalizeBoundary(item.geojson),
  }));
}

type NominatimItem = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: { country_code?: string; country?: string };
  geojson?: unknown;
};
