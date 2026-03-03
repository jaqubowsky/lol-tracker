"use client";

import { useEffect, useState } from "react";
import { fetchNews, type NewsItem } from "./action";

interface NewsTickerProps {
  onOpenNews: (uid?: string) => void;
}

export function NewsTicker({ onOpenNews }: NewsTickerProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    fetchNews().then(setNews);
  }, []);

  if (news.length === 0) return null;

  const marqueeStyle: React.CSSProperties = {
    animation: "marquee 400s linear infinite",
    animationPlayState: hovered ? "paused" : "running",
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-screen left-1/2 -translate-x-1/2 h-8 bg-bg-secondary/80 border-y border-gold-dark/30 overflow-hidden"
    >
      {/* Static label — opens modal without highlight */}
      <button
        onClick={() => onOpenNews()}
        className="absolute left-0 top-0 h-full z-10 flex items-center px-3 bg-bg-secondary/95 border-r border-gold-dark/30 text-[10px] font-bold tracking-[0.15em] text-gold-primary uppercase cursor-pointer hover:text-gold-bright transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Aktualnosci
      </button>

      {/* Marquee track */}
      <div className="h-full flex items-center pl-28">
        <div className="news-marquee flex whitespace-nowrap" style={marqueeStyle}>
          {[0, 1].map((copy) => (
            <span key={copy} className="flex items-center">
              {news.map((item) => (
                <span
                  key={`${copy}-${item.uid}`}
                  onClick={() => onOpenNews(item.uid)}
                  className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <span className="text-gold-primary/60 mx-3 text-xs select-none">
                    &#9830;
                  </span>
                  {item.categories[0] && (
                    <span className="text-[10px] uppercase tracking-wider text-blue-primary/80 mr-2 font-semibold">
                      {item.categories[0]}
                    </span>
                  )}
                  <span className="text-xs text-gold-bright/90">
                    {item.title}
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
