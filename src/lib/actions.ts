"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentMember } from "@/lib/supabase/server";
import { normalizeBoundary, searchPlaces } from "@/lib/nominatim";
import { DEFAULT_SCORES, type CriterionKey } from "@/lib/ratings";

/**
 * Кожна дія починається з перевірки учасника. Це не дублювання RLS,
 * а другий незалежний рубіж: RLS захищає дані, ця перевірка дає
 * зрозумілу помилку замість мовчазного «нічого не змінилось».
 */
async function requireMember() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
}

export async function createTrip(formData: FormData) {
  const member = await requireMember();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const place_name = String(formData.get("place_name") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "") || null;

  if (!title || !place_name || !start_date || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error("Не заповнені обовʼязкові поля подорожі.");
  }
  if (end_date && end_date < start_date) {
    throw new Error("Дата повернення раніша за дату виїзду.");
  }

  // Межі приходять рядком із прихованого поля. Довіряти йому не можна:
  // це звичайне поле форми, тож проганяємо через ту саму перевірку,
  // що й відповідь Nominatim.
  const boundary = parseBoundaryField(formData.get("boundary"));

  const { data, error } = await supabase
    .from("trips")
    .insert({
      title,
      place_name,
      country_code: String(formData.get("country_code") ?? "") || null,
      country_name: String(formData.get("country_name") ?? "") || null,
      lat,
      lng,
      start_date,
      end_date,
      boundary,
      created_by: member.user_id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect(`/trips/${data.id}`);
}

export async function updateTrip(tripId: string, formData: FormData) {
  await requireMember();
  const supabase = await createClient();

  const end_date = String(formData.get("end_date") ?? "") || null;
  const { error } = await supabase
    .from("trips")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      place_name: String(formData.get("place_name") ?? "").trim(),
      start_date: String(formData.get("start_date") ?? ""),
      end_date,
    })
    .eq("id", tripId);

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  await requireMember();
  const supabase = await createClient();

  // Спершу файли: рядки в photos зникнуть каскадом разом із подорожжю,
  // а от обʼєкти в сховищі про цей каскад не знають і лишилися б сиротами.
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("trip_id", tripId);

  if (photos && photos.length > 0) {
    await supabase.storage
      .from("trip-photos")
      .remove(photos.map((p) => p.storage_path));
  }

  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect("/");
}

export async function saveNote(tripId: string, body: string) {
  const member = await requireMember();
  const supabase = await createClient();

  // upsert по (trip_id, author_id): перше збереження створює запис,
  // подальші оновлюють його — без окремої гілки «створити чи оновити».
  const { error } = await supabase
    .from("notes")
    .upsert(
      { trip_id: tripId, author_id: member.user_id, body },
      { onConflict: "trip_id,author_id" },
    );

  if (error) throw new Error(error.message);
  revalidatePath(`/trips/${tripId}`);
}

export async function saveRating(
  tripId: string,
  scores: Record<CriterionKey, number>,
  wouldReturn: boolean,
) {
  const member = await requireMember();
  const supabase = await createClient();

  const clamped = Object.fromEntries(
    (Object.keys(DEFAULT_SCORES) as CriterionKey[]).map((key) => [
      key,
      Math.min(10, Math.max(1, Math.round(scores[key] ?? 5))),
    ]),
  );

  const { error } = await supabase.from("ratings").upsert(
    {
      trip_id: tripId,
      author_id: member.user_id,
      ...clamped,
      would_return: wouldReturn,
    },
    { onConflict: "trip_id,author_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
}

export async function registerPhoto(input: {
  tripId: string;
  storagePath: string;
  width: number;
  height: number;
  takenAt: string | null;
}) {
  const member = await requireMember();
  const supabase = await createClient();

  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", input.tripId);

  const { error } = await supabase.from("photos").insert({
    trip_id: input.tripId,
    storage_path: input.storagePath,
    width: input.width,
    height: input.height,
    taken_at: input.takenAt,
    sort_order: count ?? 0,
    uploaded_by: member.user_id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/trips/${input.tripId}`);
}

export async function deletePhoto(photoId: string, tripId: string) {
  await requireMember();
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  if (photo) {
    await supabase.storage.from("trip-photos").remove([photo.storage_path]);
  }
  await supabase.from("photos").delete().eq("id", photoId);

  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
}

export async function setCoverPhoto(photoId: string, tripId: string) {
  await requireMember();
  const supabase = await createClient();

  const { error } = await supabase
    .from("trips")
    .update({ cover_photo: photoId })
    .eq("id", tripId);

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
}

export async function savePhotoCaption(
  photoId: string,
  tripId: string,
  caption: string,
) {
  await requireMember();
  const supabase = await createClient();

  const { error } = await supabase
    .from("photos")
    .update({ caption })
    .eq("id", photoId);

  if (error) throw new Error(error.message);
  revalidatePath(`/trips/${tripId}`);
}

/**
 * Дотягує межі міста до подорожі, створеної до появи заливки.
 *
 * Шукаємо за збереженою назвою місця, а з кількох збігів беремо
 * найближчий до вже відомих координат: «Тропея» в Nominatim може
 * означати і місто, і однойменну комуну за сотні кілометрів.
 */
export async function refreshBoundary(tripId: string) {
  await requireMember();
  const supabase = await createClient();

  const { data: trip, error: readError } = await supabase
    .from("trips")
    .select("place_name, lat, lng")
    .eq("id", tripId)
    .single();

  if (readError) throw new Error(readError.message);

  const candidates = (await searchPlaces(trip.place_name)).filter(
    (r) => r.boundary !== null,
  );

  if (candidates.length === 0) {
    throw new Error(
      `Для «${trip.place_name}» Nominatim не має контуру — таке буває з горами, пляжами й дрібними селищами.`,
    );
  }

  const nearest = candidates.reduce((best, r) =>
    distance(r, trip) < distance(best, trip) ? r : best,
  );

  const { error } = await supabase
    .from("trips")
    .update({ boundary: nearest.boundary })
    .eq("id", tripId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
}

/** Квадрат відстані в градусах — для порівняння кандидатів цього досить. */
function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
}

function parseBoundaryField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value === "") return null;
  try {
    return normalizeBoundary(JSON.parse(value));
  } catch {
    return null;
  }
}
