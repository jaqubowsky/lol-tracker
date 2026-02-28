"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { onRateLimitHit, emitResume } from "@/utils/rate-limit-event";

const COUNTDOWN_SECONDS = 30;

export function RateLimitModal() {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismiss = useCallback((triggerResume: boolean) => {
    setVisible(false);
    setCountdown(COUNTDOWN_SECONDS);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (triggerResume) {
      emitResume();
    }
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          dismiss(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [dismiss]);

  useEffect(() => {
    return onRateLimitHit(() => {
      setVisible(true);
      startCountdown();
    });
  }, [startCountdown]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={() => dismiss(false)}
    >
      <div
        className="bg-bg-secondary border border-gold-dark/40 rounded-lg p-8 max-w-sm text-center shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => dismiss(false)}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          title="Zamknij"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="text-3xl mb-4">&#9888;</div>
        <h2
          className="text-gold-primary text-lg font-semibold uppercase tracking-widest mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Limit zapytań
        </h2>
        <p className="text-text-muted text-sm mb-2">
          Zbyt wiele zapytań do serwera Riot.
        </p>
        <p className="text-text-secondary text-sm mb-6">
          Odczekaj{" "}
          <span className="text-gold-bright font-semibold tabular-nums">
            {countdown}
          </span>{" "}
          {countdown === 1 ? "sekundę" : countdown < 5 ? "sekundy" : "sekund"}...
        </p>

        {/* Countdown progress bar */}
        <div className="w-full h-1 bg-bg-primary/50 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-gold-primary/60 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
          />
        </div>

        <button
          onClick={() => dismiss(true)}
          className="px-6 py-2.5 bg-gold-primary/10 border border-gold-primary/40 text-gold-primary hover:bg-gold-primary/20 hover:border-gold-primary/60 rounded text-sm uppercase tracking-widest transition-colors cursor-pointer"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Odśwież teraz
        </button>
      </div>
    </div>
  );
}
