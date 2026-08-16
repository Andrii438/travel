import Link from "next/link";
import { redirect } from "next/navigation";
import Atlas, { type TripListItem } from "@/components/atlas";
import SignOutButton from "@/components/sign-out-button";
import { createClient, getCurrentMember } from "@/lib/supabase/server";
import { pluralDays, tripDays } from "@/lib/format";
import type { Member, Photo, Rating, Trip } from "@/lib/types";

type TripRow = Trip & { ratings: Rating[]; photos: Photo[] };

export default async function HomePage() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");

  const supabase = await createClient();

  // Один запит замість трьох: PostgREST вміє вкладати повʼязані таблиці,
  // і RLS застосовується до кожної з них окремо.
  const [{ data: tripRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("trips")
      .select("*, ratings(*), photos(id, storage_path, sort_order)")
      .order("start_date", { ascending: false })
      .returns<TripRow[]>(),
    supabase.from("members").select("*").returns<Member[]>(),
  ]);

  const trips = tripRows ?? [];
  const members = memberRows ?? [];

  // Обкладинки: збираємо всі шляхи й просимо підписані посилання
  // одним викликом, а не по одному на кожну картку.
  const coverPaths = trips
    .map((t) => pickCover(t))
    .filter((p): p is string => p !== null);

  const signed = new Map<string, string>();
  if (coverPaths.length > 0) {
    const { data } = await supabase.storage
      .from("trip-photos")
      .createSignedUrls(coverPaths, 60 * 60);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  const items: TripListItem[] = trips.map((trip) => {
    const cover = pickCover(trip);
    return {
      id: trip.id,
      title: trip.title,
      place_name: trip.place_name,
      country_code: trip.country_code,
      country_name: trip.country_name,
      lat: trip.lat,
      lng: trip.lng,
      start_date: trip.start_date,
      end_date: trip.end_date,
      coverUrl: cover ? (signed.get(cover) ?? null) : null,
      photoCount: trip.photos.length,
      scores: trip.ratings.map((r) => {
        const author = members.find((m) => m.user_id === r.author_id);
        return {
          authorId: r.author_id,
          name: author?.display_name ?? "?",
          color: author?.color ?? "#78716c",
          overall: Number(r.overall),
        };
      }),
    };
  });

  const countries = new Set(
    trips.map((t) => t.country_code).filter(Boolean),
  ).size;
  const days = trips.reduce(
    (sum, t) => sum + tripDays(t.start_date, t.end_date),
    0,
  );

  return (
    <>
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-display text-xl font-semibold shrink-0">
            🗺️ Наш атлас
          </Link>

          <div className="hidden sm:flex items-center gap-4 ml-4 text-sm text-muted">
            <Stat value={trips.length} label="подорожей" />
            <Stat value={countries} label="країн" />
            <span className="tabular-nums">
              <b className="text-foreground">{pluralDays(days)}</b> у дорозі
            </span>
          </div>

          <div className="flex-1" />

          <Link
            href="/trips/new"
            className="rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            + Подорож
          </Link>
          <SignOutButton name={member.display_name} color={member.color} />
        </div>

        {/* На вузькому екрані статистика переїжджає в окремий рядок */}
        <div className="flex sm:hidden items-center gap-4 px-4 pb-2.5 text-xs text-muted">
          <Stat value={trips.length} label="подорожей" />
          <Stat value={countries} label="країн" />
          <span className="tabular-nums">
            <b className="text-foreground">{pluralDays(days)}</b> у дорозі
          </span>
        </div>
      </header>

      <Atlas trips={items} />
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="tabular-nums">
      <b className="text-foreground">{value}</b> {label}
    </span>
  );
}

/** Обкладинка: обрана вручну або найперша за порядком. */
function pickCover(trip: TripRow): string | null {
  if (trip.photos.length === 0) return null;
  const chosen = trip.photos.find((p) => p.id === trip.cover_photo);
  if (chosen) return chosen.storage_path;
  return [...trip.photos].sort((a, b) => a.sort_order - b.sort_order)[0]
    .storage_path;
}
