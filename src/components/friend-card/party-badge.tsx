"use client";

import type { Friend } from "@/utils/types";

interface PartyBadgeProps {
  playingWith: string[];
  allFriends: Friend[];
}

export function PartyBadge({ playingWith, allFriends }: PartyBadgeProps) {
  if (playingWith.length === 0) return null;

  const names = playingWith
    .map((puuid) => {
      const friend = allFriends.find((f) => f.puuid === puuid);
      return friend?.gameName ?? "???";
    })
    .join(", ");

  return (
    <span
      className="inline-flex items-center gap-1.5 bg-blue-dark/20 border border-blue-secondary/30 text-blue-bright text-[10px] font-medium px-2.5 py-1 uppercase tracking-wider"
      style={{
        clipPath: "polygon(0% 0%, calc(100% - 6px) 0%, 100% 6px, 100% 100%, 6px 100%, 0% calc(100% - 6px))",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
      Gra z: {names}
    </span>
  );
}
