"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PLAYLIST_ID = "PL7A6R2BqntOVhfytSBtGw1gygkdd9whg8";

// localStorage keys
const LS_INDEX = "yt-music-index";
const LS_TIME = "yt-music-time";
const LS_PLAYING = "yt-music-playing";
const LS_VOLUME = "yt-music-volume";
const LS_SHUFFLE = "yt-music-shuffle";
const LS_TITLE = "yt-music-title";

function loadYTScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existing = document.getElementById("yt-iframe-api");
    if (existing) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();

    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
}

export function useYouTubePlayer(containerId: string) {
  const playerRef = useRef<YT.Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_SHUFFLE) === "1";
  });
  // Restore title immediately from localStorage so UI shows it before player loads
  const [currentTitle, setCurrentTitle] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(LS_TITLE) ?? "";
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRestoring, setIsRestoring] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_INDEX) !== null;
  });

  // Playlist state
  const [playlistVideoIds, setPlaylistVideoIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const videoTitlesRef = useRef<Map<string, string>>(new Map());
  const [videoTitlesVersion, setVideoTitlesVersion] = useState(0);

  // Persistence refs
  const pendingSeekRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const wasRestoringRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasEverPlayedRef = useRef(false);
  const beforeUnloadRef = useRef<(() => void) | null>(null);
  const destroyedRef = useRef(false);
  const firstPlayHandledRef = useRef(false);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const autoplayCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save playback state to localStorage
  const saveState = useCallback(() => {
    const p = playerRef.current;
    if (!p || !hasEverPlayedRef.current) return;
    try {
      const idx = p.getPlaylistIndex();
      const time = p.getCurrentTime();
      const state = p.getPlayerState();
      const data = p.getVideoData();
      localStorage.setItem(LS_INDEX, String(idx));
      localStorage.setItem(LS_TIME, String(Math.floor(time)));
      localStorage.setItem(LS_PLAYING, state === 1 ? "1" : "0");
      if (data?.title) localStorage.setItem(LS_TITLE, data.title);
    } catch {
      // player might be destroyed already
    }
  }, []);

  useEffect(() => {
    destroyedRef.current = false;
    firstPlayHandledRef.current = false;
    pendingSeekRef.current = null;
    pendingIndexRef.current = null;
    wasRestoringRef.current = false;

    loadYTScript().then(() => {
      if (destroyedRef.current) return;

      const el = document.getElementById(containerId);
      if (!el) return;

      // Clean up any leftover iframe from a previous fast unmount
      if (el.tagName === "IFRAME" || el.querySelector("iframe")) {
        const parent = el.parentElement;
        if (parent) {
          const fresh = document.createElement("div");
          fresh.id = containerId;
          fresh.className = el.className;
          parent.replaceChild(fresh, el);
        }
      }

      // Read saved state
      const savedIndex = localStorage.getItem(LS_INDEX);
      const savedTime = localStorage.getItem(LS_TIME);
      const savedPlaying = localStorage.getItem(LS_PLAYING);
      const savedVolume = localStorage.getItem(LS_VOLUME);
      const savedShuffle = localStorage.getItem(LS_SHUFFLE);
      const shouldRestore = savedIndex !== null;

      // Queue restore
      if (shouldRestore) {
        pendingIndexRef.current = Number(savedIndex);
        pendingSeekRef.current = savedTime ? Number(savedTime) : null;
        wasRestoringRef.current = savedPlaying === "0";
        hasEverPlayedRef.current = true;
      }

      playerRef.current = new YT.Player(containerId, {
        height: "100%",
        width: "100%",
        playerVars: {
          listType: "playlist",
          list: PLAYLIST_ID,
          autoplay: shouldRestore ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
          loop: 1,
        },
        events: {
          onReady: () => {
            if (destroyedRef.current) return;
            setIsReady(true);

            const p = playerRef.current!;

            if (savedVolume !== null) {
              p.setVolume(Number(savedVolume));
            } else {
              p.setVolume(50);
            }

            p.setLoop(true);

            if (savedShuffle === "1") {
              p.setShuffle(true);
            }

            try {
              const ids = p.getPlaylist();
              if (ids?.length) setPlaylistVideoIds(ids);
            } catch {
              // not available yet
            }

            // Fallback: if autoplay was blocked, play on first user interaction
            if (shouldRestore) {
              const autoplayCheck = setTimeout(() => {
                if (destroyedRef.current || firstPlayHandledRef.current) return;
                // Autoplay didn't work — wait for any user interaction
                const triggerPlay = () => {
                  if (destroyedRef.current || firstPlayHandledRef.current) return;
                  try { playerRef.current?.playVideo(); } catch { /* ignore */ }
                  cleanup();
                };
                const cleanup = () => {
                  document.removeEventListener("click", triggerPlay);
                  document.removeEventListener("keydown", triggerPlay);
                  document.removeEventListener("scroll", triggerPlay, true);
                };
                document.addEventListener("click", triggerPlay, { once: true });
                document.addEventListener("keydown", triggerPlay, { once: true });
                document.addEventListener("scroll", triggerPlay, { once: true, capture: true });
                // Store cleanup for destroy
                interactionCleanupRef.current = cleanup;
              }, 2000); // Give autoplay 2s to work
              autoplayCheckRef.current = autoplayCheck;
            }
          },
          onStateChange: (event) => {
            if (destroyedRef.current) return;
            const state = event.data;
            setIsPlaying(state === 1);

            // First play after restore: switch to saved track
            if (state === 1 && !firstPlayHandledRef.current && pendingIndexRef.current !== null) {
              firstPlayHandledRef.current = true;
              const targetIdx = pendingIndexRef.current;
              pendingIndexRef.current = null;

              // Check if we're already on the right track
              try {
                const currentIdx = playerRef.current?.getPlaylistIndex();
                if (currentIdx !== targetIdx) {
                  // Switch to correct track — this will trigger another PLAYING state
                  playerRef.current?.playVideoAt(targetIdx);
                  return;
                }
              } catch { /* ignore */ }

              // Already on the right track, just seek
              if (pendingSeekRef.current !== null) {
                const seekTime = pendingSeekRef.current;
                pendingSeekRef.current = null;
                try {
                  playerRef.current?.seekTo(seekTime, true);
                } catch { /* ignore */ }
              }
              setIsRestoring(false);
              if (wasRestoringRef.current) {
                wasRestoringRef.current = false;
                setTimeout(() => {
                  if (destroyedRef.current) return;
                  try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
                }, 200);
              }
              return;
            }

            // After track switch from restore, handle seek
            if (state === 1 && pendingSeekRef.current !== null) {
              const seekTime = pendingSeekRef.current;
              pendingSeekRef.current = null;
              try {
                playerRef.current?.seekTo(seekTime, true);
              } catch { /* ignore */ }
              setIsRestoring(false);
              if (wasRestoringRef.current) {
                wasRestoringRef.current = false;
                setTimeout(() => {
                  if (destroyedRef.current) return;
                  try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
                }, 200);
              }
            }

            if (state === 1) {
              hasEverPlayedRef.current = true;
              firstPlayHandledRef.current = true;
              setIsRestoring(false);
            }

            // Fallback loop: if playlist ends, restart
            if (state === 0) {
              try { playerRef.current?.playVideoAt(0); } catch { /* ignore */ }
            }

            // Update title, duration, index, playlist
            if (state === 1 || state === 3) {
              try {
                const data = playerRef.current?.getVideoData();
                if (data?.title) {
                  setCurrentTitle(data.title);
                  if (data.video_id) {
                    videoTitlesRef.current.set(data.video_id, data.title);
                    setVideoTitlesVersion((v) => v + 1);
                  }
                }
              } catch { /* ignore */ }
              try {
                const dur = playerRef.current?.getDuration();
                if (dur) setDuration(dur);
              } catch { /* ignore */ }
              try {
                const idx = playerRef.current?.getPlaylistIndex();
                if (idx != null) setCurrentIndex(idx);
              } catch { /* ignore */ }
              try {
                const ids = playerRef.current?.getPlaylist();
                if (ids?.length) setPlaylistVideoIds(ids);
              } catch { /* ignore */ }
            }
          },
          onError: () => {
            if (destroyedRef.current) return;
            try { playerRef.current?.nextVideo(); } catch { /* ignore */ }
          },
        },
      });

      // Save interval (every 2s)
      saveTimerRef.current = setInterval(() => {
        if (!destroyedRef.current) saveState();
      }, 2000);

      // Save on hard refresh / tab close
      const onBeforeUnload = () => saveState();
      window.addEventListener("beforeunload", onBeforeUnload);
      beforeUnloadRef.current = onBeforeUnload;
    });

    return () => {
      destroyedRef.current = true;
      saveState();
      if (autoplayCheckRef.current) {
        clearTimeout(autoplayCheckRef.current);
        autoplayCheckRef.current = null;
      }
      if (interactionCleanupRef.current) {
        interactionCleanupRef.current();
        interactionCleanupRef.current = null;
      }
      if (beforeUnloadRef.current) {
        window.removeEventListener("beforeunload", beforeUnloadRef.current);
        beforeUnloadRef.current = null;
      }
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      setIsReady(false);
    };
  }, [containerId, saveState]);

  // Poll current time while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      if (destroyedRef.current) return;
      try {
        const t = playerRef.current?.getCurrentTime();
        if (t != null) setCurrentTime(t);
        const d = playerRef.current?.getDuration();
        if (d) setDuration(d);
      } catch { /* ignore */ }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const nextVideo = useCallback(() => playerRef.current?.nextVideo(), []);
  const previousVideo = useCallback(
    () => playerRef.current?.previousVideo(),
    []
  );

  const toggleShuffle = useCallback(() => {
    const next = !isShuffled;
    playerRef.current?.setShuffle(next);
    setIsShuffled(next);
    localStorage.setItem(LS_SHUFFLE, next ? "1" : "0");
  }, [isShuffled]);

  const setVolume = useCallback((vol: number) => {
    playerRef.current?.setVolume(vol);
    localStorage.setItem(LS_VOLUME, String(vol));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const playVideoAt = useCallback((index: number) => {
    playerRef.current?.playVideoAt(index);
    hasEverPlayedRef.current = true;
  }, []);

  return {
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
    videoTitles: videoTitlesRef.current,
    videoTitlesVersion,
  };
}
