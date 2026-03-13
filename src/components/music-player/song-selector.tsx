"use client";

import { useEffect, useState, useTransition } from "react";
import { resolveVideoTitles } from "./action";

interface SongSelectorProps {
  videoIds: string[];
  currentIndex: number;
  cachedTitles: Map<string, string>;
  onPlay: (index: number) => void;
}

export function SongSelector({
  videoIds,
  currentIndex,
  cachedTitles,
  onPlay,
}: SongSelectorProps) {
  const [titles, setTitles] = useState<Map<string, string>>(
    () => new Map(cachedTitles)
  );
  const [isPending, startTransition] = useTransition();

  // Resolve missing titles via server action
  useEffect(() => {
    if (videoIds.length === 0) return;

    const missing = videoIds.filter((id) => !titles.has(id));
    if (missing.length === 0) return;

    startTransition(async () => {
      const resolved = await resolveVideoTitles(missing);
      setTitles((prev) => {
        const next = new Map(prev);
        for (const { videoId, title } of resolved) {
          if (title) next.set(videoId, title);
        }
        return next;
      });
    });
  }, [videoIds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (videoIds.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-text-muted text-xs">
        {isPending ? "Ładowanie playlisty..." : "Brak utworów"}
      </div>
    );
  }

  return (
    <div className="max-h-[200px] sm:max-h-[300px] overflow-y-auto scrollbar-thin">
      {videoIds.map((id, index) => {
        const title = titles.get(id);
        const isCurrent = index === currentIndex;

        return (
          <button
            key={`${id}-${index}`}
            onClick={() => onPlay(index)}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors cursor-pointer hover:bg-gold-primary/5"
            style={{
              background: isCurrent
                ? "linear-gradient(90deg, rgba(200, 170, 110, 0.08), transparent)"
                : undefined,
            }}
          >
            {/* Track number or speaker icon */}
            <span
              className="w-5 text-right text-[10px] shrink-0 tabular-nums"
              style={{
                color: isCurrent
                  ? "var(--color-gold-primary)"
                  : "var(--color-text-muted)",
              }}
            >
              {isCurrent ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="inline"
                >
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              ) : (
                index + 1
              )}
            </span>

            {/* Title */}
            <span
              className="text-xs truncate flex-1"
              style={{
                color: isCurrent
                  ? "var(--color-gold-bright)"
                  : "var(--color-text-secondary)",
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              {title ?? (isPending ? "..." : `Utwór ${index + 1}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
