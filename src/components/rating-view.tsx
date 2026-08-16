import { CRITERIA, scoreColor } from "@/lib/ratings";
import type { Rating } from "@/lib/types";

/** Оцінки партнера — тільки для читання (запис заборонено на рівні RLS). */
export default function RatingView({ rating }: { rating: Rating | null }) {
  if (!rating) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
        Оцінок ще немає.
      </div>
    );
  }

  const overall = Number(rating.overall);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h4 className="text-sm font-medium">Оцінки</h4>
        <span
          className="font-display text-2xl font-semibold tabular-nums"
          style={{ color: scoreColor(overall) }}
        >
          {overall.toFixed(1)}
        </span>
      </div>

      <div className="space-y-2.5">
        {CRITERIA.map(({ key, label, emoji }) => {
          const score = rating[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">
                {emoji} {label}
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score * 10}%`,
                    background: scoreColor(score),
                  }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums">
                {score}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-muted">
        {rating.would_return
          ? "✓ Хоче повернутися сюди ще раз"
          : "— Повертатися не планує"}
      </p>
    </div>
  );
}
