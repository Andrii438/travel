import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

// Обидва шрифти з кириличним підмножинним набором — інакше українські
// літери підмінялися б системним шрифтом і «стрибали» б у верстці.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Наш атлас",
  description: "Приватний щоденник наших подорожей",
  // Сторінка приватна — просимо пошуковики навіть не намагатися.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
  width: "device-width",
  initialScale: 1,
  // Мапа сама обробляє жести — подвійний тап не має зумити сторінку.
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${inter.variable} ${lora.variable} h-full antialiased`}
    >
      {/* На десктопі застосунок займає рівно екран (мапа на всю висоту),
          на мобільному — звичайна сторінка, що гортається. */}
      <body className="min-h-full flex flex-col lg:h-dvh lg:overflow-hidden">
        {children}
      </body>
    </html>
  );
}
