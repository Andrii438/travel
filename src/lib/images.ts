/**
 * Обробка фото на боці браузера: стиснення перед відправкою
 * і читання дати зйомки з EXIF.
 */

export type PreparedImage = {
  blob: Blob;
  width: number;
  height: number;
  takenAt: string | null;
};

const MAX_SIDE = 2000; // достатньо для перегляду на будь-якому екрані
const QUALITY = 0.82;

/**
 * Зменшує фото до MAX_SIDE по довшій стороні й перекодовує у WebP.
 * Типовий кадр з телефона: 5 МБ JPEG → ~300 КБ WebP без помітної втрати.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const takenAt = await readExifDate(file);

  // imageOrientation: "from-image" — обовʼязково. Canvas не знає про
  // EXIF-поворот, тож без цього всі вертикальні фото лягли б набік.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не дав доступу до canvas.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  if (!blob) throw new Error("Не вдалося стиснути зображення.");

  return { blob, width, height, takenAt };
}

/**
 * Мінімальний парсер EXIF: шукає лише тег DateTimeOriginal (0x9003).
 *
 * Повноцінна EXIF-бібліотека важить сотні кілобайт; нам потрібне одне
 * поле, тож читаємо перші 128 КБ файлу і йдемо по структурі вручну.
 * Формат: JPEG-маркери → сегмент APP1 → TIFF-заголовок → IFD0 →
 * вказівник на Exif-IFD → потрібний тег.
 */
async function readExifDate(file: File): Promise<string | null> {
  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) return null;

  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return null; // не JPEG

    let offset = 2;
    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);

      if (marker === 0xe1) {
        // APP1: перевіряємо сигнатуру "Exif\0\0"
        if (view.getUint32(offset + 4) !== 0x45786966) return null;
        return parseTiff(view, offset + 10);
      }
      offset += 2 + size;
    }
  } catch {
    /* пошкоджений або незвичний файл — просто лишаємо дату порожньою */
  }
  return null;
}

function parseTiff(view: DataView, tiffStart: number): string | null {
  const little = view.getUint16(tiffStart) === 0x4949; // 'II' vs 'MM'
  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);

  const exifIfdOffset = findTag(view, ifd0, tiffStart, little, 0x8769);
  if (exifIfdOffset === null) return null;

  const raw = readAscii(view, tiffStart + exifIfdOffset, tiffStart, little);
  if (!raw) return null;

  // EXIF пише "2024:07:14 18:32:05" — двокрапки в даті ламають Date().
  const [datePart, timePart] = raw.trim().split(" ");
  if (!datePart || !timePart) return null;
  const iso = `${datePart.replace(/:/g, "-")}T${timePart}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Повертає значення тега як число (для вказівників на під-IFD). */
function findTag(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  little: boolean,
  tag: number,
): number | null {
  const count = view.getUint16(ifdStart, little);
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (view.getUint16(entry, little) === tag) {
      return view.getUint32(entry + 8, little);
    }
  }
  return null;
}

/** Шукає DateTimeOriginal усередині Exif-IFD і читає його як ASCII. */
function readAscii(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  little: boolean,
): string | null {
  const count = view.getUint16(ifdStart, little);
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (view.getUint16(entry, little) !== 0x9003) continue;

    const length = view.getUint32(entry + 4, little);
    const valueOffset = tiffStart + view.getUint32(entry + 8, little);
    let out = "";
    for (let j = 0; j < length - 1; j++) {
      out += String.fromCharCode(view.getUint8(valueOffset + j));
    }
    return out;
  }
  return null;
}
