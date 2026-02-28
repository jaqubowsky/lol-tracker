import { Suspense } from "react";
import { PlayerDetailPage } from "./player-detail";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ puuid: string }>;
}) {
  const { puuid } = await params;

  return (
    <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 min-h-screen">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="w-8 h-8 border-2 border-gold-dark border-t-gold-primary rounded-full animate-spin mb-4" />
          <p className="text-text-muted text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            Ładowanie profilu...
          </p>
        </div>
      }>
        <PlayerDetailPage puuid={puuid} />
      </Suspense>
    </main>
  );
}
