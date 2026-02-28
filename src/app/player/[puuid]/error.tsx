"use client";

import Link from "next/link";

export default function PlayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1
          className="text-5xl sm:text-6xl font-bold text-gold-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Błąd
        </h1>
        <h2
          className="text-xl font-bold text-text-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Nie udało się załadować profilu
        </h2>
        <p className="text-text-muted text-sm mb-6">
          {error.message || "Nie udało się załadować danych gracza."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-block px-4 py-2 bg-gold-dark/40 border border-gold-secondary/60 text-gold-bright text-sm uppercase tracking-wider rounded hover:bg-gold-dark/60 transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-gold-dark/40 border border-gold-secondary/60 text-gold-bright text-sm uppercase tracking-wider rounded hover:bg-gold-dark/60 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Strona główna
          </Link>
        </div>
      </div>
    </div>
  );
}
