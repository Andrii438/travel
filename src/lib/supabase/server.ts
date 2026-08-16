import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Клієнт для Server Components, Server Actions і Route Handlers.
 *
 * Створюється НА КОЖЕН запит — не можна тримати його в модульній
 * змінній, бо на serverless-платформі один процес обслуговує різних
 * користувачів, і сесія «протекла» б між ними.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component не має права писати cookie — це нормально:
          // оновленням токенів займається proxy.ts перед рендером.
        }
      },
    },
  });
}

/** Поточний учасник або null. Використовується на кожній захищеній сторінці. */
export async function getCurrentMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("members")
    .select("user_id, email, display_name, color")
    .eq("user_id", user.id)
    .maybeSingle();

  return member ?? null;
}
