import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1
          className="text-5xl sm:text-6xl font-bold text-gold-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          404
        </h1>
        <h2
          className="text-xl font-bold text-text-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Nie znaleziono gracza
        </h2>
        <p className="text-text-muted text-sm mb-6">
          Gracz o podanym identyfikatorze nie istnieje lub dane nie są dostępne.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-gold-dark/40 border border-gold-secondary/60 text-gold-bright text-sm uppercase tracking-wider rounded hover:bg-gold-dark/60 transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Strona główna
        </Link>
      </div>
    </div>
  );
}
