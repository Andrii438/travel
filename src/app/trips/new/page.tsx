import Link from "next/link";
import { redirect } from "next/navigation";
import TripForm from "@/components/trip-form";
import { getCurrentMember } from "@/lib/supabase/server";

export default async function NewTripPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");

  return (
    <main className="flex-1 overflow-y-auto px-5 py-8">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← До мапи
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-3 mb-6">
          Нова подорож
        </h1>
        <TripForm />
      </div>
    </main>
  );
}
