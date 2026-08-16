"use client";

/* eslint-disable @next/next/no-img-element -- посилання підписані й тимчасові,
   оптимізатор Next кешував би їх довше, ніж вони живі */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto, savePhotoCaption } from "@/lib/actions";

export type GalleryPhoto = {
  id: string;
  url: string;
  caption: string;
  width: number | null;
  height: number | null;
};

export default function PhotoGallery({
  tripId,
  photos,
}: {
  tripId: string;
  photos: GalleryPhoto[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Стрілки й Esc у переглядачі — дрібниця, без якої гортати боляче.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight")
        setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
      if (e.key === "ArrowLeft")
        setOpenIndex((i) =>
          i === null ? null : (i - 1 + photos.length) % photos.length,
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, photos.length]);

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted">
        Фото ще немає. Вони стискаються прямо в браузері, тож можна сміливо
        вантажити просто з телефона.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2"
          >
            <img
              src={photo.url}
              alt={photo.caption}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          tripId={tripId}
          photos={photos}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  tripId,
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  tripId: string;
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const photo = photos[index];

  function commitCaption(value: string) {
    if (value === photo.caption) return;
    startTransition(async () => {
      await savePhotoCaption(photo.id, tripId, value);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 p-3 text-white/80"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Видалити це фото назавжди?")) return;
              startTransition(async () => {
                await deletePhoto(photo.id, tripId);
                onClose();
                router.refresh();
              });
            }}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-red-500/80 transition-colors"
          >
            Видалити
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2">
        {photos.length > 1 && (
          <NavArrow
            side="left"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + photos.length) % photos.length);
            }}
          />
        )}
        <img
          src={photo.url}
          alt={photo.caption}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
        {photos.length > 1 && (
          <NavArrow
            side="right"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % photos.length);
            }}
          />
        )}
      </div>

      <div className="p-3" onClick={(e) => e.stopPropagation()}>
        {/* key={photo.id} — поле перемонтовується при гортанні й саме
            підхоплює новий підпис, тому синхронізувати стан ефектом
            не доводиться взагалі. */}
        <input
          key={photo.id}
          defaultValue={photo.caption}
          onBlur={(e) => commitCaption(e.target.value)}
          placeholder="Підпис до фото…"
          className="mx-auto block w-full max-w-xl rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-white/40 transition-colors"
        />
      </div>
    </div>
  );
}

function NavArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Попереднє фото" : "Наступне фото"}
      className={`absolute ${side === "left" ? "left-2" : "right-2"} z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 transition-colors`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
