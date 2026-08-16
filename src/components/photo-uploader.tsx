"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerPhoto } from "@/lib/actions";
import { prepareImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

export default function PhotoUploader({ tripId }: { tripId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setProgress({ done: 0, total: list.length });

    const supabase = createClient();
    let failed = 0;

    // Послідовно, а не паралельно: мобільний браузер на десятку
    // одночасних canvas-операцій просто вбиває вкладку по памʼяті.
    for (let i = 0; i < list.length; i++) {
      try {
        const { blob, width, height, takenAt } = await prepareImage(list[i]);
        const path = `${tripId}/${crypto.randomUUID()}.webp`;

        const { error: uploadError } = await supabase.storage
          .from("trip-photos")
          .upload(path, blob, { contentType: "image/webp", upsert: false });

        if (uploadError) throw uploadError;

        await registerPhoto({
          tripId,
          storagePath: path,
          width,
          height,
          takenAt,
        });
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: list.length });
    }

    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (failed > 0) setError(`Не вдалося завантажити фото: ${failed}`);
    router.refresh();
  }

  const busy = progress !== null;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
      >
        {busy
          ? `Завантажую ${progress.done} з ${progress.total}…`
          : "📷 Додати фото"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
