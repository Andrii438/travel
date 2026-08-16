/**
 * Читання конфігурації з падінням у зрозумілу помилку.
 *
 * Supabase у нових проєктах видає ключ під назвою "Publishable key"
 * (sb_publishable_...), у старих — "anon public" (eyJ...). Обидва
 * працюють однаково, тож приймаємо будь-який.
 */
function required(name: string, ...candidates: (string | undefined)[]): string {
  const value = candidates.find((v) => v && v.length > 0);
  if (!value) {
    throw new Error(
      `Не задано ${name}. Скопіюйте .env.local.example у .env.local ` +
        `і підставте значення з Supabase → Project Settings → API.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
