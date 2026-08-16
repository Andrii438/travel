"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { flagEmoji, formatDateRange, pluralDays, tripDays } from "@/lib/format";
import type { TripBoundary } from "@/lib/nominatim";
import { scoreColor } from "@/lib/ratings";

// MapLibre звертається до window ще під час імпорту модуля, тому вантажимо
// його лише в браузері — інакше build падає на етапі пререндеру.
const WorldMap = dynamic(() => import("./world-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-surface-2 text-sm text-muted">
      Розгортаємо мапу…
    </div>
  ),
});

export type TripListItem = {
  id: string;
  title: string;
  place_name: string;
  country_code: string | null;
  country_name: string | null;
  lat: number;
  lng: number;
  start_date: string;
  end_date: string | null;
  coverUrl: string | null;
  photoCount: number;
  boundary: TripBoundary | null;
  scores: {
    authorId: string;
    name: string;
    color: string;
    overall: number;
  }[];
};

export default function Atlas({ trips }: { trips: TripListItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Вибір піна на мапі підкручує список до відповідної картки.
  useEffect(() => {
    if (!selected) return;
    cardRefs.current[selected]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selected]);

  const mapTrips = trips.map((t) => ({
    id: t.id,
    title: t.title,
    place_name: t.place_name,
    country_code: t.country_code,
    lat: t.lat,
    lng: t.lng,
    boundary: t.boundary,
    score:
      t.scores.length > 0
        ? t.scores.reduce((s, x) => s + x.overall, 0) / t.scores.length
        : null,
  }));

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      <div className="h-[48vh] shrink-0 lg:h-full lg:flex-1 lg:shrink">
        <WorldMap
          trips={mapTrips}
          selectedId={selected}
          onSelect={setSelected}
        />
      </div>

      <aside className="lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-l border-line bg-background">
        {trips.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-line">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  ref={(el) => {
                    cardRefs.current[trip.id] = el;
                  }}
                  onMouseEnter={() => setSelected(trip.id)}
                  onFocus={() => setSelected(trip.id)}
                  className={`flex gap-3.5 p-4 transition-colors ${
                    selected === trip.id ? "bg-accent-soft" : "hover:bg-surface"
                  }`}
                >
                  <Cover trip={trip} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base leading-none">
                        {flagEmoji(trip.country_code)}
                      </span>
                      <h3 className="font-display font-semibold truncate">
                        {trip.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted truncate mt-0.5">
                      {trip.place_name}
                    </p>
                    <p className="text-xs text-muted mt-1 tabular-nums">
                      {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
                      {pluralDays(tripDays(trip.start_date, trip.end_date))}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2">
                      {trip.scores.map((s) => (
                        <span
                          key={s.authorId}
                          title={`${s.name}: ${s.overall} з 10`}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums"
                          style={{ background: scoreColor(s.overall) }}
                        >
                          <span className="opacity-80">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                          {s.overall}
                        </span>
                      ))}
                      {trip.scores.length === 0 && (
                        <span className="text-[11px] text-muted">
                          ще без оцінок
                        </span>
                      )}
                      {trip.photoCount > 0 && (
                        <span className="text-[11px] text-muted ml-auto">
                          📷 {trip.photoCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function Cover({ trip }: { trip: TripListItem }) {
  if (trip.coverUrl) {
    return (
      // Звичайний <img>: посилання підписані й живуть годину, тому
      // оптимізатор зображень Next тут тільки заважав би кешуванням.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={trip.coverUrl}
        alt=""
        className="h-20 w-20 shrink-0 rounded-xl object-cover bg-surface-2"
        loading="lazy"
      />
    );
  }
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-surface-2 text-2xl">
      {flagEmoji(trip.country_code)}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="text-4xl mb-3">✈️</div>
      <h2 className="font-display text-lg font-semibold">Атлас поки порожній</h2>
      <p className="text-sm text-muted mt-1.5 mb-5">
        Додайте першу подорож — і на мапі зʼявиться перший пін.
      </p>
      <Link
        href="/trips/new"
        className="inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Додати подорож
      </Link>
    </div>
  );
}
