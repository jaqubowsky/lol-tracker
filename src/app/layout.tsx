import type { Metadata } from "next";
import { Cinzel, Fira_Sans } from "next/font/google";
import Script from "next/script";
import { RateLimitModal } from "@/components/rate-limit-modal";
import { MusicPlayer } from "@/components/music-player/music-player";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const firaSans = Fira_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "LoL Tracker - Sprawdź kto gra",
    template: "%s | LoL Tracker",
  },
  description:
    "Śledź znajomych w League of Legends na żywo. Sprawdzaj rangi, aktualne mecze i historie gier — EUNE i EUW.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL || "https://localhost:3000"
  ),
  keywords: [
    "League of Legends",
    "LoL",
    "tracker",
    "live game",
    "EUNE",
    "EUW",
    "rangi",
    "sprawdź kto gra",
  ],
  authors: [{ name: "jaqubowsky", url: "https://github.com/jaqubowsky" }],
  creator: "jaqubowsky",
  openGraph: {
    title: "LoL Tracker - Sprawdź kto gra",
    description:
      "Śledź znajomych w League of Legends na żywo. Rangi, live game, historia meczy — wszystko w jednym miejscu.",
    type: "website",
    locale: "pl_PL",
    siteName: "LoL Tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoL Tracker - Sprawdź kto gra",
    description:
      "Śledź znajomych w League of Legends na żywo. Rangi, live game, historia meczy.",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  other: {
    "theme-color": "#010a13",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${cinzel.variable} ${firaSans.variable} bg-bg-primary text-text-primary min-h-dvh relative flex flex-col`}
      >
        <div className="relative z-10 flex-1 pb-36">{children}</div>
        <RateLimitModal />
        <MusicPlayer />
        <Script
          defer
          src="https://umami.jnalewajk.me/script.js"
          data-website-id="562028ee-6e0c-4fc4-ad2c-d9a7f5ca98ec"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
