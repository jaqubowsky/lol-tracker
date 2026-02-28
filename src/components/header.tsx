"use client";

export function Header() {
  return (
    <header className="relative text-center pt-8 pb-6 sm:pt-10 sm:pb-8">
      {/* Decorative top line */}
      <div className="lol-divider max-w-xs mx-auto mb-6" />

      {/* Title */}
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[0.1em] sm:tracking-[0.15em] uppercase gold-shimmer"
        style={{ fontFamily: "var(--font-display)" }}
      >
        LoL Tracker
      </h1>

      {/* Subtitle */}
      <p
        className="text-text-secondary mt-2 sm:mt-3 text-xs sm:text-sm tracking-[0.15em] sm:tracking-[0.25em] uppercase"
        style={{ fontFamily: "var(--font-body)" }}
      >
        Sprawdź kto gra
      </p>

      {/* Decorative bottom line */}
      <div className="lol-divider max-w-lg mx-auto mt-6" />

      {/* Diamond ornament in center of bottom divider */}
      <div className="flex justify-center -mt-[3px]">
        <div className="w-[6px] h-[6px] rotate-45 bg-gold-secondary" />
      </div>
    </header>
  );
}
