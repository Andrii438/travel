# 🗺️ Наш атлас

Приватний щоденник подорожей для двох. Мапа світу з пінами, враження
й оцінки окремо від кожного, фото зі стисненням прямо в браузері.

Доступ мають рівно двоє людей, заведених вручну. Реєстрації немає в принципі.

---

## Налаштування — один раз, ~20 хвилин

### 1. Створити проєкт у Supabase

1. [supabase.com](https://supabase.com) → **New project**
2. Region: **Frankfurt** або **London** (найближчі до України — менші затримки)
3. Придумайте й **збережіть** пароль до бази (знадобиться рідко, але відновити його не можна)

### 2. Виконати схему бази

Supabase → **SQL Editor** → **New query** → вставити весь вміст файлу
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

Створяться таблиці, політики доступу і приватний бакет для фото.

### 3. Завести двох користувачів

Supabase → **Authentication** → **Users** → **Add user** → **Create new user**:

- пошта + пароль
- увімкнути галочку **Auto Confirm User**

Повторити для другої людини. **Більше нікого не додавайте — це і є весь список допуску.**

Далі закрити реєстрацію ззовні: **Authentication → Sign In / Providers → Email**
→ вимкнути **Allow new users to sign up**.

### 4. Внести обох у таблицю учасників

SQL Editor → нова вкладка → підставте свої адреси та імена:

```sql
insert into public.members (user_id, email, display_name, color)
select id, email, 'Ваше імʼя', '#2563eb' from auth.users where email = 'you@example.com'
on conflict (user_id) do update set display_name = excluded.display_name, color = excluded.color;

insert into public.members (user_id, email, display_name, color)
select id, email, 'Імʼя дружини', '#e11d48' from auth.users where email = 'wife@example.com'
on conflict (user_id) do update set display_name = excluded.display_name, color = excluded.color;
```

`color` — колір аватарки та підпису біля оцінок. Можна будь-який HEX.

### 5. Прописати ключі локально

Supabase → **Project Settings** → **API Keys**. Скопіювати два значення
у файл `.env.local` (він уже створений із заглушками):

```
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проєкт.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> Ключ `service_role` сюди не додавати ніколи: він обходить усі політики RLS.

Запустити:

```bash
npm run dev
```

Відкрити http://localhost:3000 і зайти під створеною поштою й паролем.

### 6. Викласти в інтернет (Vercel)

```bash
git init && git add -A && git commit -m "Наш атлас"
```

Створити **приватний** репозиторій на GitHub, запушити, далі
[vercel.com](https://vercel.com) → **Add New Project** → обрати репозиторій →
у **Environment Variables** додати ті самі два рядки з `.env.local` → **Deploy**.

Останній крок: Supabase → **Authentication** → **URL Configuration** →
у **Site URL** та **Redirect URLs** додати адресу з Vercel — інакше
посилання для входу з пошти вестимуть на localhost.

---

## Як влаштована приватність

| Рубіж | Що робить |
|---|---|
| Немає реєстрації | `shouldCreateUser: false` + вимкнений sign-up у Supabase |
| `proxy.ts` | Відкидає неавторизований запит ще до рендеру сторінки |
| RLS у Postgres | Кожна таблиця віддає рядки лише учаснику з таблиці `members` |
| `with check (author_id = auth.uid())` | Кожен редагує лише свої враження й оцінки |
| Приватний бакет | У фото немає постійних URL — лише підписані посилання на 1 годину |
| `robots: noindex` | Сайт не потрапляє в пошукові системи |

Навіть якщо публічний ключ із коду сайту потрапить до чужих рук, база
поверне порожній результат: захист лежить на рівні даних, а не інтерфейсу.

## Структура

```
supabase/schema.sql        таблиці, політики RLS, бакет для фото
src/proxy.ts               оновлення сесії + захист маршрутів
src/lib/actions.ts         усі записи в базу (Server Actions)
src/lib/images.ts          стиснення фото і читання дати з EXIF
src/lib/supabase/          клієнти для браузера та сервера
src/components/world-map   мапа MapLibre з пінами
src/app/trips/[id]         сторінка подорожі: фото, враження, оцінки
```

## Скільки це коштує

Нуль. Supabase free (500 МБ бази, 1 ГБ файлів), Vercel Hobby,
тайли CARTO і геокодер Nominatim — усе без карток і ключів.

Фото стискаються в браузері до ~300 КБ, тож 1 ГБ — це приблизно
**2500 знімків**. Коли стане тісно, є два шляхи: Supabase Pro
($25/міс, 100 ГБ) або підключити Cloudflare R2 (10 ГБ безкоштовно).

## Що можна доробити далі

- Зафарбовування відвіданих країн на мапі (потрібен GeoJSON кордонів)
- Сторінка статистики: подорожі по роках, улюблені критерії, найбільші розбіжності
- Експорт усього атласу в PDF на памʼять
- Вхід через Google замість пароля
