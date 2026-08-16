import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/nominatim";
import { getCurrentMember } from "@/lib/supabase/server";

export type { GeocodeResult } from "@/lib/nominatim";

/**
 * Пошук місця йде через наш сервер, а не напряму з браузера, з двох причин:
 *   1) Nominatim вимагає осмислений User-Agent, який браузер підмінити не дасть;
 *   2) так координати й тексти пошуку не звʼязуються з IP вашого телефона.
 */
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await searchPlaces(q));
}
