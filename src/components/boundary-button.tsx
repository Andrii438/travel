"use client";

import { useState, useTransition } from "react";
import { refreshBoundary } from "@/lib/actions";

/**
 * Подорожі, створені до появи заливки, не мають меж у базі. Замість
 * автоматичного дозапиту при кожному відкритті сторінки — явна кнопка:
 * Nominatim просить не частіше запиту в секунду, і смикати його на
 * кожен рендер було б і повільно, і нечемно.
 */
export default function BoundaryButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await refreshBoundary(tripId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не вдалося знайти межі.");
            }
          });
        }}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:bg-surface-2 transition-colors disabled:opacity-50"
      >
        {pending ? "Шукаю межі…" : "🗺️ Зафарбувати місто на мапі"}
      </button>
      {error && <p className="mt-1.5 text-xs text-amber-600">{error}</p>}
    </div>
  );
}
