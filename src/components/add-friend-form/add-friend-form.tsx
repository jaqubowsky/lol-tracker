"use client";

import { useState } from "react";
import { riotIdSchema } from "./schema";
import { resolveFriend } from "./action";
import { checkRateLimit } from "@/utils/rate-limit-event";
import type { Friend, Region } from "@/utils/types";

interface AddFriendFormProps {
  onAdd: (friend: Friend) => void;
}

export function AddFriendForm({ onAdd }: AddFriendFormProps) {
  const [input, setInput] = useState("");
  const [region, setRegion] = useState<Region>("eun1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = riotIdSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const friend = await resolveFriend(
        parsed.data.gameName,
        parsed.data.tagLine,
        region
      );
      onAdd(friend);
      setInput("");
    } catch (err) {
      checkRateLimit(err);
      setError(
        err instanceof Error ? err.message : "Błąd serwera"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-10 mt-2">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 lol-input-wrap">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nazwa#TAG"
            disabled={loading}
            className="lol-input px-5 py-3 text-sm disabled:opacity-50"
          />
        </div>
        <div className="flex shrink-0 overflow-hidden border border-gold-dark/50 bg-bg-secondary/60">
          {(["eun1", "euw1"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              disabled={loading}
              className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                region === r
                  ? "bg-gold-primary/20 text-gold-bright border-b-2 border-b-gold-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-gold-primary/5 border-b-2 border-b-transparent"
              }`}
            >
              {r === "eun1" ? "EUNE" : "EUW"}
            </button>
          ))}
        </div>
        <div className="lol-button-wrap shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="lol-button px-8 py-3 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Szukam...
            </span>
          ) : (
            "Dodaj Przyjaciela"
          )}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-danger text-xs mt-2 ml-1 tracking-wider uppercase">{error}</p>
      )}
    </form>
  );
}
