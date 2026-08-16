import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="flex-1 grid place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🗺️</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Наш атлас
          </h1>
          <p className="text-muted text-sm mt-2">
            Тільки для двох. Більше ні для кого.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
