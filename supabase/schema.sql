-- =============================================================
--  Наш атлас — схема бази даних
--  Виконати один раз у Supabase → SQL Editor → New query
-- =============================================================

-- -------------------------------------------------------------
-- 1. УЧАСНИКИ
-- -------------------------------------------------------------
-- Рівно два рядки — ви і дружина. Ця таблиця є "білим списком":
-- хто не тут, той не бачить жодного рядка в усій базі.
create table if not exists public.members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  color        text not null default '#e11d48', -- колір підпису та піна на мапі
  created_at   timestamptz not null default now()
);

-- Helper-функція, на якій тримається вся приватність.
-- SECURITY DEFINER — обовʼязково: функція має читати members в обхід
-- її власного RLS, інакше політика викликала б сама себе (рекурсія).
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members m where m.user_id = auth.uid());
$$;

-- -------------------------------------------------------------
-- 2. ПОДОРОЖІ
-- -------------------------------------------------------------
create table if not exists public.trips (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  place_name   text not null,                 -- «Ліссабон», «Карпати, Драгобрат»
  country_code text,                          -- ISO 3166-1 alpha-2, напр. 'PT'
  country_name text,
  lat          double precision not null,
  lng          double precision not null,
  start_date   date not null,
  end_date     date,
  cover_photo  uuid,                          -- FK додається нижче
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists trips_start_date_idx on public.trips (start_date desc);
create index if not exists trips_country_idx    on public.trips (country_code);

-- -------------------------------------------------------------
-- 3. ВРАЖЕННЯ — окремий запис на кожного з вас
-- -------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  author_id  uuid not null references auth.users (id),
  body       text not null default '',
  updated_at timestamptz not null default now(),
  unique (trip_id, author_id)                 -- по одному нарису від кожного
);

create index if not exists notes_trip_idx on public.notes (trip_id);

-- -------------------------------------------------------------
-- 4. ОЦІНКИ — теж окремо від кожного
-- -------------------------------------------------------------
-- Шкала 1..10 за пʼятьма критеріями. `overall` рахує сама база:
-- це generated-колонка, її неможливо розсинхронізувати з критеріями.
create table if not exists public.ratings (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  author_id    uuid not null references auth.users (id),
  food         smallint not null default 5 check (food    between 1 and 10),
  nature       smallint not null default 5 check (nature  between 1 and 10),
  culture      smallint not null default 5 check (culture between 1 and 10),
  value        smallint not null default 5 check (value   between 1 and 10),
  vibe         smallint not null default 5 check (vibe    between 1 and 10),
  would_return boolean  not null default true,
  overall      numeric(3,1) generated always as
                 (round((food + nature + culture + value + vibe)::numeric / 5, 1)) stored,
  updated_at   timestamptz not null default now(),
  unique (trip_id, author_id)
);

create index if not exists ratings_trip_idx on public.ratings (trip_id);

-- -------------------------------------------------------------
-- 5. ФОТО
-- -------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  storage_path text not null unique,          -- шлях у бакеті trip-photos
  caption      text not null default '',
  width        integer,
  height       integer,
  taken_at     timestamptz,
  sort_order   integer not null default 0,
  uploaded_by  uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);

create index if not exists photos_trip_idx on public.photos (trip_id, sort_order);

-- Обкладинка подорожі — вже після створення photos, бо звʼязок круговий.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trips_cover_photo_fkey'
  ) then
    alter table public.trips
      add constraint trips_cover_photo_fkey
      foreign key (cover_photo) references public.photos (id) on delete set null;
  end if;
end $$;

-- -------------------------------------------------------------
-- 6. АВТООНОВЛЕННЯ updated_at
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trips_touch   on public.trips;
drop trigger if exists notes_touch   on public.notes;
drop trigger if exists ratings_touch on public.ratings;

create trigger trips_touch   before update on public.trips
  for each row execute function public.touch_updated_at();
create trigger notes_touch   before update on public.notes
  for each row execute function public.touch_updated_at();
create trigger ratings_touch before update on public.ratings
  for each row execute function public.touch_updated_at();

-- =============================================================
-- 7. ПРИВАТНІСТЬ: Row Level Security
-- =============================================================
-- Після ALTER ... ENABLE ROW LEVEL SECURITY таблиця за замовчуванням
-- не віддає НІЧОГО. Кожен доступ треба дозволити явно. Тому навіть
-- якщо хтось дістане публічний anon-ключ із коду сайту — база
-- відповість порожнім результатом.

alter table public.members enable row level security;
alter table public.trips   enable row level security;
alter table public.notes   enable row level security;
alter table public.ratings enable row level security;
alter table public.photos  enable row level security;

-- members: бачити одне одного можна, змінювати — ні (тільки через SQL Editor)
drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.is_member());

-- trips: обидва бачать і редагують усе спільне
drop policy if exists trips_all on public.trips;
create policy trips_all on public.trips
  for all using (public.is_member()) with check (public.is_member());

-- photos: так само спільні
drop policy if exists photos_all on public.photos;
create policy photos_all on public.photos
  for all using (public.is_member()) with check (public.is_member());

-- notes і ratings: читають обоє, але пише кожен ТІЛЬКИ свій запис.
-- `with check (author_id = auth.uid())` — саме те, що не дасть
-- (навіть випадково, багом у клієнті) переписати враження партнера.
drop policy if exists notes_read   on public.notes;
drop policy if exists notes_write  on public.notes;
create policy notes_read on public.notes
  for select using (public.is_member());
create policy notes_write on public.notes
  for all using (public.is_member() and author_id = auth.uid())
      with check (public.is_member() and author_id = auth.uid());

drop policy if exists ratings_read  on public.ratings;
drop policy if exists ratings_write on public.ratings;
create policy ratings_read on public.ratings
  for select using (public.is_member());
create policy ratings_write on public.ratings
  for all using (public.is_member() and author_id = auth.uid())
      with check (public.is_member() and author_id = auth.uid());

-- =============================================================
-- 8. СХОВИЩЕ ФОТО
-- =============================================================
-- public = false: у файлів немає постійних URL. Застосунок видає
-- тимчасові підписані посилання (1 година) лише залогіненому учаснику.
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;

drop policy if exists trip_photos_all on storage.objects;
create policy trip_photos_all on storage.objects
  for all using (bucket_id = 'trip-photos' and public.is_member())
      with check (bucket_id = 'trip-photos' and public.is_member());

-- =============================================================
-- 9. ОСТАННІЙ КРОК — додати себе у список учасників
-- =============================================================
-- Спершу створіть двох користувачів у Supabase → Authentication → Users
-- → Add user → Create new user (email + пароль, галочка Auto Confirm).
-- Потім розкоментуйте і виконайте, підставивши свої email та імена:
--
-- insert into public.members (user_id, email, display_name, color)
-- select id, email, 'Ваше імʼя', '#2563eb' from auth.users where email = 'you@example.com'
-- on conflict (user_id) do update set display_name = excluded.display_name,
--                                     color = excluded.color;
--
-- insert into public.members (user_id, email, display_name, color)
-- select id, email, 'Імʼя дружини', '#e11d48' from auth.users where email = 'wife@example.com'
-- on conflict (user_id) do update set display_name = excluded.display_name,
--                                     color = excluded.color;
