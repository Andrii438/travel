/**
 * Прапорець країни з ISO-коду без жодних картинок і залежностей.
 *
 * Кожна літера A–Z має «регіональний» двійник у Unicode; пара таких
 * символів рендериться операційною системою як прапор. Тобто 'UA'
 * перетворюється на 🇺🇦 простим арифметичним зсувом код-поінтів.
 */
export function flagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const OFFSET = 0x1f1e6 - "A".charCodeAt(0);
  return countryCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + OFFSET))
    .join("");
}

const dateFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
});

/** «12–18 травня 2024» замість «12 травня 2024 – 18 травня 2024». */
export function formatDateRange(start: string, end: string | null): string {
  const from = new Date(start);
  if (!end) return dateFmt.format(from);

  const to = new Date(end);
  if (from.getTime() === to.getTime()) return dateFmt.format(from);

  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (sameMonth) {
    return `${from.getDate()}–${dateFmt.format(to)}`;
  }
  if (sameYear) {
    return `${shortFmt.format(from)} – ${dateFmt.format(to)}`;
  }
  return `${dateFmt.format(from)} – ${dateFmt.format(to)}`;
}

/** Тривалість подорожі в днях, включно з першим і останнім днем. */
export function tripDays(start: string, end: string | null): number {
  if (!end) return 1;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${n} дні`;
  return `${n} днів`;
}
