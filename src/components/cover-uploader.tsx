"use client";

/* eslint-disable @next/next/no-img-element -- посилання підписані й тимчасові,
   оптимізатор Next кешував би їх довше, ніж вони живі */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeCoverImage, setCoverImage } from "@/lib/actions";
import { prepareImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

/**
 * Заставка подорожі — окрема картинка, яка НЕ потрапляє в галерею.
 * Проходить те саме стиснення, що й фото: 5 МБ з телефона стають
 * приблизно 300 КБ ще до відправки.
 */
export default function CoverUploader({
  tripId,
  coverUrl,
}: {
  tripId: string;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setError(null);
    setBusy(true);
    try {
      const { blob } = await prepareImage(file);
      // Нове імʼя на кожне завантаження: інакше браузер показував би
      // стару картинку з кешу за тим самим шляхом.
      const path = `${tripId}/cover-${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabaseUpload(path, blob);
      if (uploadError) throw uploadError;

      await setCoverImage(tripId, path);
      router.refresh();
    } catch {
      setError("Не вдалося завантажити заставку. Спробуйте ще раз.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeCoverImage(tripId);
      router.refresh();
    } catch {
      setError("Не вдалося прибрати заставку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files)}
      />

      {coverUrl ? (
        <img
          src={coverUrl}
          alt="Заставка подорожі"
          className="h-16 w-16 shrink-0 rounded-xl object-cover bg-surface-2"
        />
      ) : (
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-line text-xl text-muted">
          🖼️
        </div>
      )}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {busy
              ? "Завантажую…"
              : coverUrl
                ? "Замінити заставку"
                : "Обрати заставку"}
          </button>

          {coverUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Прибрати
            </button>
          )}
        </div>

        <p className="mt-1 text-xs text-muted">
          {coverUrl
            ? "Так подорож виглядає у списку на головній."
            : "Поки не обрано — у списку показується перше фото."}
        </p>
        {error && <p className="mt-1 text-xs text-amber-600">{error}</p>}
      </div>
    </div>
  );
}

/** Обгортка навколо сховища — щоб компонент читався зверху вниз. */
async function supabaseUpload(path: string, blob: Blob) {
  const supabase = createClient();
  return supabase.storage
    .from("trip-photos")
    .upload(path, blob, { contentType: "image/webp", upsert: false });
}
