import type { TripBoundary } from "./nominatim";

export type Member = {
  user_id: string;
  email: string;
  display_name: string;
  color: string;
};

export type Trip = {
  id: string;
  title: string;
  place_name: string;
  country_code: string | null;
  country_name: string | null;
  lat: number;
  lng: number;
  start_date: string;
  end_date: string | null;
  /** Заставка подорожі: шлях у сховищі. null — показуємо перше фото. */
  cover_image: string | null;
  /** Межі міста з Nominatim. null — місце без полігона (гора, пляж). */
  boundary: TripBoundary | null;
  created_by: string;
  created_at: string;
};

export type Note = {
  id: string;
  trip_id: string;
  author_id: string;
  body: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  trip_id: string;
  author_id: string;
  food: number;
  nature: number;
  culture: number;
  value: number;
  vibe: number;
  would_return: boolean;
  overall: number;
  updated_at: string;
};

export type Photo = {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
};

/** Подорож із підтягнутими враженнями, оцінками та кількістю фото. */
export type TripWithDetails = Trip & {
  notes: Note[];
  ratings: Rating[];
  photos: Photo[];
};
