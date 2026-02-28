import type { Metadata } from "next";
import { Cinzel, Fira_Sans } from "next/font/google";
import { RateLimitModal } from "@/components/rate-limit-modal";
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
    default: "LoL Tracker",
    template: "%s | LoL Tracker",
  },
  description: "Sprawdź kto gra — live tracker dla znajomych z League of Legends",
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || "https://localhost:3000"),
  openGraph: {
    title: "LoL Tracker",
    description: "Sprawdź kto gra — live tracker dla znajomych z League of Legends",
    type: "website",
    locale: "pl_PL",
  },
  twitter: {
    card: "summary",
    title: "LoL Tracker",
    description: "Sprawdź kto gra — live tracker dla znajomych z League of Legends",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={`${cinzel.variable} ${firaSans.variable} bg-bg-primary text-text-primary min-h-screen relative flex flex-col`}>
        <div className="relative z-10 flex-1">
          {children}
        </div>
        <footer className="relative z-10 py-6 text-text-muted text-[11px] tracking-wider">
          <div className="lol-divider max-w-xs mx-auto mb-4" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-text-muted/60">
              &copy; {new Date().getFullYear()} LoL Tracker. Not affiliated with Riot Games.
            </p>
            <a
              href="https://github.com/jaqubowsky"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-text-muted/80 hover:text-text-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              jaqubowsky
            </a>
          </div>
        </footer>
        <RateLimitModal />
      </body>
    </html>
  );
}
