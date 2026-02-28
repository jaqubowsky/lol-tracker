"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PLAYLIST_ID = "PLVtd53WJ5E4k7u8deZv5byvGlEOTbl-AT";

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
  const [isShuffled, setIsShuffled] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let destroyed = false;

    loadYTScript().then(() => {
      if (destroyed) return;

      const el = document.getElementById(containerId);
      if (!el) return;

      playerRef.current = new YT.Player(containerId, {
        height: "100%",
        width: "100%",
        playerVars: {
          listType: "playlist",
          list: PLAYLIST_ID,
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!destroyed) {
              setIsReady(true);
              playerRef.current?.setVolume(50);
            }
          },
          onStateChange: (event) => {
            if (destroyed) return;
            const state = event.data;
            setIsPlaying(state === 1);
            if (state === 1 || state === 3) {
              try {
                const data = playerRef.current?.getVideoData();
                if (data?.title) setCurrentTitle(data.title);
              } catch {
                // getVideoData may not be available yet
              }
              try {
                const dur = playerRef.current?.getDuration();
                if (dur) setDuration(dur);
              } catch {
                // not available yet
              }
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [containerId]);

  // Poll current time while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime();
        if (t != null) setCurrentTime(t);
        const d = playerRef.current?.getDuration();
        if (d) setDuration(d);
      } catch {
        // ignore
      }
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
  }, [isShuffled]);

  const setVolume = useCallback((vol: number) => {
    playerRef.current?.setVolume(vol);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  return {
    isReady,
    isPlaying,
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
  };
}
