import type { Rating } from "./types";

/** Ключі критеріїв збігаються з назвами колонок у таблиці ratings. */
export const CRITERIA = [
  { key: "food", label: "Їжа", emoji: "🍽️" },
  { key: "nature", label: "Природа", emoji: "🏔️" },
  { key: "culture", label: "Культура", emoji: "🏛️" },
  { key: "value", label: "Ціна/якість", emoji: "💰" },
  { key: "vibe", label: "Атмосфера", emoji: "✨" },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const DEFAULT_SCORES: Record<CriterionKey, number> = {
  food: 5,
  nature: 5,
  culture: 5,
  value: 5,
  vibe: 5,
};

/**
 * Колір оцінки: від приглушеного бурштинового до соковитого зеленого.
 * Свідомо без червоного — це щоденник спогадів, а не рейтинг готелів,
 * і «6 з 10» тут не має виглядати як провал.
 */
export function scoreColor(score: number): string {
  if (score >= 9) return "#059669";
  if (score >= 7.5) return "#65a30d";
  if (score >= 6) return "#ca8a04";
  if (score >= 4) return "#d97706";
  return "#b45309";
}

/** Наскільки розійшлися ваші оцінки — те, заради чого все й затівалось. */
export function disagreement(ratings: Rating[]): number | null {
  if (ratings.length < 2) return null;
  return Math.abs(Number(ratings[0].overall) - Number(ratings[1].overall));
}

/** Середня оцінка подорожі по обох учасниках. */
export function averageOverall(ratings: Rating[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + Number(r.overall), 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
