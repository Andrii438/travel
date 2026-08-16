"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "link";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Не вдалося увійти. Перевірте пошту та пароль.");
      setBusy(false);
      return;
    }

    // router.refresh() змушує сервер перерендерити з уже наявною сесією —
    // без цього proxy.ts побачив би старі cookie і відкинув назад на /login.
    router.replace(next);
    router.refresh();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Ключовий рядок для приватності: заборонено створювати нових
        // користувачів. Хто не заведений вручну в Supabase — не увійде,
        // навіть якщо знає адресу сайту.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setBusy(false);
    if (error) {
      setError("Ця пошта не має доступу до атласу.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <div className="text-3xl mb-3">📬</div>
        <p className="text-sm">
          Посилання для входу надіслано на <b>{email}</b>. Відкрийте його на
          цьому ж пристрої.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={mode === "password" ? signInWithPassword : sendMagicLink}
      className="rounded-2xl border border-line bg-surface p-6 space-y-4"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1.5">
          Пошта
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-[16px] outline-none focus:border-accent transition-colors"
          placeholder="ви@example.com"
        />
      </div>

      {mode === "password" && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1.5">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-[16px] outline-none focus:border-accent transition-colors"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-accent px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy
          ? "Хвилинку…"
          : mode === "password"
            ? "Увійти"
            : "Надіслати посилання"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "password" ? "link" : "password");
          setError(null);
        }}
        className="w-full text-sm text-muted hover:text-foreground transition-colors"
      >
        {mode === "password"
          ? "Забули пароль? Увійти за посиланням з пошти"
          : "Увійти паролем"}
      </button>
    </form>
  );
}
