"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { GeocodeResult } from "@/lib/nominatim";
import { createTrip } from "@/lib/actions";
import { flagEmoji } from "@/lib/format";

export default function TripForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [place, setPlace] = useState<GeocodeResult | null>(null);
  const [title, setTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const titleTouched = useRef(false);

  // Пошук із затримкою 400 мс і скасуванням попереднього запиту:
  // Nominatim просить не частіше запиту в секунду, та й без цього
  // відповіді приходили б не в тому порядку, в якому їх слали.
  useEffect(() => {
    // Місце вже обране — шукати нема чого. Очищення списку живе
    // в обробнику onChange, щоб не смикати стан прямо з ефекту.
    const q = query.trim();
    if (q.length < 2 || place) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      // Індикатор вмикаємо тут, а не в тілі ефекту: під час 400 мс
      // паузи запиту ще немає, тож і показувати нема чого.
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        setResults(res.ok ? await res.json() : []);
      } catch {
        /* запит скасовано новим введенням — це нормально */
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, place]);

  function choose(result: GeocodeResult) {
    setPlace(result);
    setQuery(result.place);
    setResults([]);
    if (!titleTouched.current && !title) setTitle(result.place);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={createTrip} className="space-y-5">
      {/* Знайдені координати їдуть на сервер прихованими полями */}
      <input type="hidden" name="lat" value={place?.lat ?? ""} />
      <input type="hidden" name="lng" value={place?.lng ?? ""} />
      <input type="hidden" name="country_code" value={place?.countryCode ?? ""} />
      <input type="hidden" name="country_name" value={place?.countryName ?? ""} />
      <input type="hidden" name="place_name" value={place?.place ?? ""} />
      {/* Межі міста їдуть на сервер рядком: FormData не вміє обʼєктів,
          а окремий запит до Nominatim за тим самим місцем був би зайвим. */}
      <input
        type="hidden"
        name="boundary"
        value={place?.boundary ? JSON.stringify(place.boundary) : ""}
      />

      <div className="relative">
        <label htmlFor="place" className="block text-sm font-medium mb-1.5">
          Куди їздили?
        </label>
        <input
          id="place"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setPlace(null);
            if (next.trim().length < 2) setResults([]);
          }}
          autoComplete="off"
          placeholder="Ліссабон, Драгобрат, Занзібар…"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] outline-none focus:border-accent transition-colors"
        />

        {searching && (
          <span className="absolute right-3 top-9 text-xs text-muted">…</span>
        )}

        {results.length > 0 && (
          <ul className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => choose(r)}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="text-lg leading-tight">
                    {flagEmoji(r.countryCode)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{r.place}</span>
                    <span className="block text-xs text-muted truncate">
                      {r.label}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {place && (
          <p className="mt-1.5 text-xs text-muted">
            {flagEmoji(place.countryCode)} {place.countryName ?? "—"} ·{" "}
            <span className="tabular-nums">
              {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
            </span>
            {place.boundary ? " · межі знайдено" : " · без меж, лише пін"}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1.5">
          Назва подорожі
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => {
            titleTouched.current = true;
            setTitle(e.target.value);
          }}
          placeholder="Наша перша Португалія"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium mb-1.5">
            Виїхали
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            max={today}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium mb-1.5">
            Повернулись
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            max={today}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton disabled={!place} />
        <Link
          href="/"
          className="rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-surface transition-colors"
        >
          Скасувати
        </Link>
        {!place && (
          <span className="text-xs text-muted">Спершу оберіть місце зі списку</span>
        )}
      </div>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  // useFormStatus читає стан батьківської <form> — тому кнопка мусить
  // бути окремим компонентом усередині неї, а не частиною TripForm.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {pending ? "Зберігаємо…" : "Додати на мапу"}
    </button>
  );
}
