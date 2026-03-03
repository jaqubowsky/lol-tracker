"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { fetchNews, type NewsItem } from "./action";

interface NewsModalProps {
  onClose: () => void;
  highlightUid?: string;
}

export function NewsModal({ onClose, highlightUid }: NewsModalProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(highlightUid ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    fetchNews().then(setNews);
  }, []);

  // Scroll to highlighted article once news loads
  useEffect(() => {
    if (highlighted && news.length > 0 && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear highlight after 2s
      const timer = setTimeout(() => setHighlighted(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlighted, news]);

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of news) {
      for (const cat of item.categories) {
        set.add(cat);
      }
    }
    const pinned = ["Patch Notes", "Patch Notes TFT"];
    const rest = Array.from(set).filter((c) => !pinned.includes(c)).sort();
    return [...pinned.filter((c) => set.has(c)), ...rest];
  }, [news]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return news.filter((item) => {
      if (activeCategory && !item.categories.includes(activeCategory)) {
        return false;
      }
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [news, search, activeCategory]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm scoreboard-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-secondary border border-gold-dark/40 w-full max-w-3xl h-[90vh] mx-3 flex flex-col scoreboard-panel hex-clip-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2
            className="text-lg font-bold uppercase tracking-[0.15em] text-gold-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Aktualnosci
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer p-1"
            title="Zamknij"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="lol-divider mx-5" />

        {/* Search + category filters */}
        <div className="px-5 py-3 space-y-3">
          <div className="lol-input-wrap">
            <input
              type="text"
              placeholder="Szukaj wiadomosci..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lol-input px-4 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1 text-[11px] uppercase tracking-wider font-semibold border transition-colors cursor-pointer ${
                activeCategory === null
                  ? "bg-gold-primary/20 border-gold-primary/60 text-gold-bright"
                  : "bg-transparent border-gold-dark/30 text-text-muted hover:text-text-secondary hover:border-gold-dark/50"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              Wszystkie
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`px-3 py-1 text-[11px] uppercase tracking-wider font-semibold border transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? "bg-gold-primary/20 border-gold-primary/60 text-gold-bright"
                    : "bg-transparent border-gold-dark/30 text-text-muted hover:text-text-secondary hover:border-gold-dark/50"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="lol-divider mx-5" />

        {/* News list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted text-sm tracking-wider uppercase">
                Brak wynikow
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <a
                key={item.uid}
                ref={item.uid === highlighted ? highlightedRef : undefined}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col sm:flex-row gap-3 p-3 border transition-all duration-500 group ${
                  item.uid === highlighted
                    ? "bg-gold-primary/10 border-gold-primary/50 ring-1 ring-gold-primary/30"
                    : "bg-bg-card/60 border-gold-dark/20 hover:border-gold-dark/40 hover:bg-bg-card-hover/60"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-full sm:w-40 h-24 sm:h-24 flex-shrink-0 overflow-hidden bg-bg-surface/50">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.categories[0] && (
                      <span className="text-[10px] uppercase tracking-wider text-blue-primary font-semibold">
                        {item.categories[0]}
                      </span>
                    )}
                    <span className="text-[10px] text-text-muted">
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gold-bright/90 group-hover:text-gold-bright transition-colors leading-snug mb-1 line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
