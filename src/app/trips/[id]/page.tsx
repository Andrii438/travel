import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BoundaryButton from "@/components/boundary-button";
import DeleteTripButton from "@/components/delete-trip-button";
import NoteEditor from "@/components/note-editor";
import PhotoGallery, { type GalleryPhoto } from "@/components/photo-gallery";
import PhotoUploader from "@/components/photo-uploader";
import RatingEditor from "@/components/rating-editor";
import RatingView from "@/components/rating-view";
import { flagEmoji, formatDateRange, pluralDays, tripDays } from "@/lib/format";
import { disagreement } from "@/lib/ratings";
import { createClient, getCurrentMember } from "@/lib/supabase/server";
import type { Member, Note, Photo, Rating, Trip } from "@/lib/types";

type TripRow = Trip & { notes: Note[]; ratings: Rating[]; photos: Photo[] };

export default async function TripPage({ params }: PageProps<"/trips/[id]">) {
  const { id } = await params;

  const me = await getCurrentMember();
  if (!me) redirect("/login");

  const supabase = await createClient();

  const [{ data: trip, error: tripError }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("trips")
        // photos!photos_trip_id_fkey — явно вказуємо, ЯКИЙ саме звʼязок
        // між trips і photos брати. Їх два (photos.trip_id і trips.cover_photo),
        // і без підказки PostgREST відмовляється вкладати таблицю взагалі.
        .select("*, notes(*), ratings(*), photos!photos_trip_id_fkey(*)")
        .eq("id", id)
        .maybeSingle<TripRow>(),
      supabase.from("members").select("*").returns<Member[]>(),
    ]);

  // Помилку запиту не можна плутати з «подорожі немає»: інакше будь-яка
  // проблема з базою виглядала б як 404 і нічого не підказувала.
  if (tripError) {
    throw new Error(`Не вдалося завантажити подорож: ${tripError.message}`);
  }
  if (!trip) notFound();

  const members = memberRows ?? [];
  const partner = members.find((m) => m.user_id !== me.user_id) ?? null;

  const myNote = trip.notes.find((n) => n.author_id === me.user_id) ?? null;
  const myRating = trip.ratings.find((r) => r.author_id === me.user_id) ?? null;
  const partnerNote = partner
    ? (trip.notes.find((n) => n.author_id === partner.user_id) ?? null)
    : null;
  const partnerRating = partner
    ? (trip.ratings.find((r) => r.author_id === partner.user_id) ?? null)
    : null;

  // Фото сортуємо за датою зйомки — так галерея сама вибудовується
  // в хронологію дня, навіть якщо вантажили їх у випадковому порядку.
  const ordered = [...trip.photos].sort((a, b) => {
    if (a.taken_at && b.taken_at) return a.taken_at.localeCompare(b.taken_at);
    return a.sort_order - b.sort_order;
  });

  const gallery: GalleryPhoto[] = [];
  if (ordered.length > 0) {
    const { data: signed } = await supabase.storage
      .from("trip-photos")
      .createSignedUrls(
        ordered.map((p) => p.storage_path),
        60 * 60,
      );

    const urls = new Map(
      (signed ?? [])
        .filter((s) => s.path && s.signedUrl)
        .map((s) => [s.path as string, s.signedUrl]),
    );

    for (const photo of ordered) {
      const url = urls.get(photo.storage_path);
      if (!url) continue;
      gallery.push({
        id: photo.id,
        url,
        caption: photo.caption,
        width: photo.width,
        height: photo.height,
        isCover: trip.cover_photo === photo.id,
      });
    }
  }

  const gap = disagreement(trip.ratings);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← До мапи
          </Link>
          <DeleteTripButton tripId={trip.id} />
        </div>

        <header className="mt-4 mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="mr-2">{flagEmoji(trip.country_code)}</span>
            {trip.title}
          </h1>
          <p className="mt-2 text-muted">
            {trip.place_name}
            {trip.country_name ? `, ${trip.country_name}` : ""} ·{" "}
            {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
            {pluralDays(tripDays(trip.start_date, trip.end_date))}
          </p>

          {!trip.boundary && <BoundaryButton tripId={trip.id} />}

          {gap !== null && (
            <p className="mt-3 inline-block rounded-full bg-surface-2 px-3 py-1 text-sm">
              {gap === 0
                ? "🤝 Ваші оцінки збіглися день у день"
                : gap < 1
                  ? `🤝 Розбіжність в оцінках — лише ${gap.toFixed(1)} бала`
                  : `🤔 Розбіжність в оцінках — ${gap.toFixed(1)} бала`}
            </p>
          )}
        </header>

        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Фото {gallery.length > 0 && (
                <span className="text-muted font-sans text-sm font-normal">
                  ({gallery.length})
                </span>
              )}
            </h2>
            <PhotoUploader tripId={trip.id} />
          </div>
          <PhotoGallery tripId={trip.id} photos={gallery} />
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <Panel
            name={me.display_name}
            color={me.color}
            badge="ви"
            note={
              <NoteEditor
                tripId={trip.id}
                initial={myNote?.body ?? ""}
                placeholder="Що запамʼяталося? Запахи, розмови, дрібниці, які через рік не згадаєш…"
              />
            }
            rating={<RatingEditor tripId={trip.id} initial={myRating} />}
          />

          <Panel
            name={partner?.display_name ?? "Другий учасник"}
            color={partner?.color ?? "#78716c"}
            badge={null}
            note={
              partnerNote?.body ? (
                <div className="whitespace-pre-wrap rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed">
                  {partnerNote.body}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-muted">
                  Враження ще не написані.
                </div>
              )
            }
            rating={<RatingView rating={partnerRating} />}
          />
        </section>
      </div>
    </main>
  );
}

function Panel({
  name,
  color,
  badge,
  note,
  rating,
}: {
  name: string;
  color: string;
  badge: string | null;
  note: React.ReactNode;
  rating: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ background: color }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <h3 className="font-display font-semibold">{name}</h3>
        {badge && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
            {badge}
          </span>
        )}
      </div>
      {note}
      {rating}
    </div>
  );
}
