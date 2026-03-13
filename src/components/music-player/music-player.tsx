"use client";

import { useState, useEffect, useRef } from "react";
import { useYouTubePlayer } from "./use-youtube-player";
import { SongSelector } from "./song-selector";

const PLAYER_CONTAINER_ID = "yt-music-player";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicPlayer() {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [volume, setVolumeLocal] = useState(() => {
    if (typeof window === "undefined") return 50;
    const saved = localStorage.getItem("yt-music-volume");
    return saved !== null ? Number(saved) : 50;
  });
  const progressRef = useRef<HTMLDivElement>(null);

  const {
    isReady,
    isPlaying,
    isRestoring,
    isShuffled,
    currentTitle,
    currentTime,
    duration,
    play,
    pause,
    nextVideo,
    previousVideo,
    toggleShuffle,
    setVolume,
    seekTo,
    playVideoAt,
    playlistVideoIds,
    currentIndex,
    videoTitles,
    videoTitlesVersion: _vt,
  } = useYouTubePlayer(PLAYER_CONTAINER_ID);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const handleVolumeChange = (val: number) => {
    setVolumeLocal(val);
    setVolume(val);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 music-player-enter">
      {/* Gold top border */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, var(--color-gold-dark) 20%, var(--color-gold-secondary) 50%, var(--color-gold-dark) 80%, transparent 95%)",
        }}
      />
      {/* Teal energy line when playing */}
      <div
        className="absolute top-[1px] left-0 right-0 h-[1px] transition-opacity duration-700"
        style={{
          opacity: isPlaying ? 1 : 0,
          background:
            "linear-gradient(90deg, transparent 10%, var(--color-blue-glow) 50%, transparent 90%)",
          boxShadow:
            "0 0 8px rgba(10, 200, 185, 0.4), 0 0 20px rgba(10, 200, 185, 0.15)",
        }}
      />

      <div
        className="relative"
        style={{
          background:
            "linear-gradient(180deg, rgba(10, 22, 40, 0.97) 0%, rgba(1, 10, 19, 0.99) 100%)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Combined panel: song selector (left) + iframe (right) */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="flex gap-3 py-3 px-4 max-w-4xl mx-auto items-stretch" style={{ height: "288px" }}>
              {/* Song list — left */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <SongSelector
                  videoIds={playlistVideoIds}
                  currentIndex={currentIndex}
                  cachedTitles={videoTitles}
                  onPlay={playVideoAt}
                />
              </div>
              {/* Video — right, fills full height */}
              <div
                className="shrink-0 rounded overflow-hidden yt-iframe-fill h-full"
                style={{
                  aspectRatio: "16/9",
                  border: "1px solid var(--color-gold-dark)",
                  boxShadow:
                    "0 0 20px rgba(10, 200, 185, 0.1), inset 0 0 30px rgba(0,0,0,0.5)",
                }}
              >
                <div id={PLAYER_CONTAINER_ID} className="w-full h-full" />
              </div>
            </div>
            <div
              className="h-[1px] mx-6"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--color-gold-dark), transparent)",
              }}
            />
          </div>
        </div>

        {/* Title — click to toggle panel */}
        {currentTitle && (
          <div className="mx-auto px-4 pt-2 overflow-hidden">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-[11px] text-center truncate cursor-pointer hover:text-gold-primary transition-colors"
              style={{
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
              }}
              title={currentTitle}
            >
              {currentTitle}
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div className="max-w-2xl mx-auto px-4 pt-1.5">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] tabular-nums w-8 text-right flex-shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatTime(currentTime)}
            </span>
            <div
              ref={progressRef}
              className="flex-1 h-3 flex items-center cursor-pointer group"
              onClick={handleProgressClick}
            >
              <div className="w-full h-[3px] rounded-full bg-gold-muted/30 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-linear"
                  style={{
                    width: `${progress}%`,
                    background:
                      "linear-gradient(90deg, var(--color-gold-dark), var(--color-gold-primary))",
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    left: `${progress}%`,
                    marginLeft: "-5px",
                    background: "var(--color-gold-primary)",
                    boxShadow: "0 0 4px rgba(200, 170, 110, 0.5)",
                  }}
                />
              </div>
            </div>
            <span
              className="text-[10px] tabular-nums w-8 flex-shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Controls row — 3-col grid: empty | transport | volume (desktop) */}
        <div className="max-w-2xl mx-auto px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Left spacer */}
          <div />

          {/* Center — transport */}
          <div className="flex items-center gap-0.5 justify-center">
            <button
              onClick={toggleShuffle}
              disabled={!isReady || isRestoring}
              className="music-btn-sm group relative cursor-pointer disabled:cursor-not-allowed disabled:opacity-20"
              title={isShuffled ? "Losowe: wł." : "Losowe: wył."}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="transition-colors"
                style={{
                  color: isShuffled
                    ? "var(--color-blue-primary)"
                    : "var(--color-text-muted)",
                }}
              >
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
              </svg>
              {isShuffled && (
                <div
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "var(--color-blue-primary)" }}
                />
              )}
            </button>

            <button
              onClick={previousVideo}
              disabled={!isReady || isRestoring}
              className="music-btn group cursor-pointer disabled:cursor-not-allowed disabled:opacity-20"
              title="Poprzedni"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            <button
              onClick={isPlaying ? pause : play}
              disabled={!isReady || isRestoring}
              className="music-btn-play group relative cursor-pointer disabled:cursor-not-allowed disabled:opacity-20"
              title={isRestoring ? "Wznawianie..." : isPlaying ? "Pauza" : "Odtwarzaj"}
            >
              <div
                className="absolute inset-0 rounded-full transition-opacity duration-500"
                style={{
                  opacity: isPlaying ? 1 : 0,
                  boxShadow:
                    "0 0 12px rgba(200, 170, 110, 0.3), 0 0 4px rgba(10, 200, 185, 0.2)",
                }}
              />
              <div
                className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: isPlaying
                    ? "linear-gradient(135deg, var(--color-gold-secondary), var(--color-gold-dark))"
                    : "linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-muted))",
                  border: "1px solid var(--color-gold-dark)",
                }}
              >
                {isRestoring ? (
                  <div className="w-4 h-4 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-bg-primary)">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="var(--color-gold-bright)"
                    style={{ marginLeft: "2px" }}
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            </button>

            <button
              onClick={nextVideo}
              disabled={!isReady || isRestoring}
              className="music-btn group cursor-pointer disabled:cursor-not-allowed disabled:opacity-20"
              title="Następny"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="music-btn-sm group cursor-pointer"
              title={expanded ? "Zwiń" : "Rozwiń wideo"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="transition-all duration-300"
                style={{
                  color: expanded
                    ? "var(--color-gold-primary)"
                    : "var(--color-text-muted)",
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
              </svg>
            </button>
          </div>

          {/* Right — volume (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-2 justify-end">
            <button
              onClick={() => handleVolumeChange(volume === 0 ? 50 : 0)}
              className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
              title={volume === 0 ? "Przywróć głośność" : "Wycisz"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                {volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : volume < 50 ? (
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            <div className="relative w-[80px]">
              <div className="h-[3px] rounded-full bg-gold-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${volume}%`,
                    background:
                      "linear-gradient(90deg, var(--color-gold-dark), var(--color-gold-primary))",
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                title={`Głośność: ${volume}%`}
              />
            </div>
          </div>
        </div>

        {/* Volume — mobile only, bottom row */}
        <div className="sm:hidden flex items-center justify-center gap-2 pb-2">
          <button
            onClick={() => handleVolumeChange(volume === 0 ? 50 : 0)}
            className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            title={volume === 0 ? "Przywróć głośność" : "Wycisz"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              {volume === 0 ? (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              ) : volume < 50 ? (
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              ) : (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              )}
            </svg>
          </button>
          <div className="relative w-[100px]">
            <div className="h-[3px] rounded-full bg-gold-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${volume}%`,
                  background:
                    "linear-gradient(90deg, var(--color-gold-dark), var(--color-gold-primary))",
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              title={`Głośność: ${volume}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
