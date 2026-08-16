import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * У Next.js 16 файл middleware.ts перейменовано на proxy.ts.
 * Тут ми робимо дві речі:
 *   1) оновлюємо токен сесії до того, як почнеться рендер сторінки;
 *   2) відсікаємо неавторизованих ще на межі мережі, не даючи їм
 *      навіть завантажити код застосунку.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Між createServerClient і getUser() не має бути жодного коду:
  // будь-яка вставка тут ламає оновлення токенів і призводить до
  // випадкових розлогінень, які потім дуже важко відтворити.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Повертати треба саме цей обʼєкт: у ньому лежать оновлені cookie.
  return response;
}

export const config = {
  matcher: [
    // Усе, крім статики та зображень.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
