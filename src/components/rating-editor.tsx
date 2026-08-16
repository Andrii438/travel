"use client";

import { useEffect, useRef, useState } from "react";
import { saveRating } from "@/lib/actions";
import {
  CRITERIA,
  DEFAULT_SCORES,
  scoreColor,
  type CriterionKey,
} from "@/lib/ratings";
import type { Rating } from "@/lib/types";

type Props = {
  tripId: string;
  initial: Rating | null;
};

export default function RatingEditor({ tripId, initial }: Props) {
  const [scores, setScores] = useState<Record<CriterionKey, number>>(() =>
    initial
      ? {
          food: initial.food,
          nature: initial.nature,
          culture: initial.culture,
          value: initial.value,
          vibe: initial.vibe,
        }
      : { ...DEFAULT_SCORES },
  );
  const [wouldReturn, setWouldReturn] = useState(initial?.would_return ?? true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const first = useRef(true);

  // Оцінка рахується тут лише для миттєвого відгуку в інтерфейсі;
  // авторитетне значення все одно порахує база (generated column).
  const overall =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) / CRITERIA.length) * 10,
    ) / 10;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setDirty(true);
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await saveRating(tripId, scores, wouldReturn);
        setDirty(false);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [scores, wouldReturn, tripId]);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h4 className="text-sm font-medium">Оцінки</h4>
        <div className="flex items-baseline gap-2">
          {(dirty || saving) && (
            <span className="text-[11px] text-muted">зберігаю…</span>
          )}
          <span
            className="font-display text-2xl font-semibold tabular-nums"
            style={{ color: scoreColor(overall) }}
          >
            {overall.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {CRITERIA.map(({ key, label, emoji }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm">
              {emoji} {label}
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={scores[key]}
              onChange={(e) =>
                setScores((s) => ({ ...s, [key]: Number(e.target.value) }))
              }
              aria-label={label}
              className="flex-1"
              style={
                { "--thumb": scoreColor(scores[key]) } as React.CSSProperties
              }
            />
            <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums">
              {scores[key]}
            </span>
          </div>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={wouldReturn}
          onChange={(e) => setWouldReturn(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Хочу повернутися сюди ще раз
      </label>
    </div>
  );
}
