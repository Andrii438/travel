"use client";

import { useEffect, useRef, useState } from "react";
import { saveNote } from "@/lib/actions";

type Props = {
  tripId: string;
  initial: string;
  placeholder: string;
};

export default function NoteEditor({ tripId, initial, placeholder }: Props) {
  const [body, setBody] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef(initial);

  // Автозбереження через 1.2 с після останнього натискання клавіші.
  // Кнопки «Зберегти» немає свідомо: щоденник пишеться уривками,
  // і найгірше, що може статися — втратити абзац, забувши натиснути.
  useEffect(() => {
    if (body === saved.current) return;

    const timer = setTimeout(async () => {
      setStatus("saving");
      try {
        await saveNote(tripId, body);
        saved.current = body;
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [body, tripId]);

  // Позначку «збережено» прибираємо через дві секунди, щоб не миготіла.
  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  // Попередження, якщо закрити вкладку до спрацювання автозбереження.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (body !== saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [body]);

  return (
    <div className="relative">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={8}
        className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-accent transition-colors"
      />
      <span
        className={`absolute bottom-3 right-3 text-[11px] transition-opacity ${
          status === "idle" ? "opacity-0" : "opacity-100 text-muted"
        }`}
      >
        {status === "saving" ? "зберігаю…" : "збережено"}
      </span>
    </div>
  );
}
