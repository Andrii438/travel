"use client";

import { useTransition } from "react";
import { deleteTrip } from "@/lib/actions";

export default function DeleteTripButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Видалити подорож разом з усіма фото та враженнями? Це незворотно.",
          )
        )
          return;
        startTransition(() => deleteTrip(tripId));
      }}
      className="rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {pending ? "Видаляю…" : "Видалити подорож"}
    </button>
  );
}
