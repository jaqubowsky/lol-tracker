declare namespace YT {
  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    playerVars?: {
      autoplay?: 0 | 1;
      controls?: 0 | 1;
      listType?: "playlist" | "user_uploads";
      list?: string;
      loop?: 0 | 1;
      modestbranding?: 0 | 1;
      rel?: 0 | 1;
      fs?: 0 | 1;
      playsinline?: 0 | 1;
    };
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: OnErrorEvent) => void;
    };
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    data: number;
    target: Player;
  }

  interface OnErrorEvent {
    data: number;
    target: Player;
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    nextVideo(): void;
    previousVideo(): void;
    setVolume(volume: number): void;
    getVolume(): number;
    setShuffle(shuffle: boolean): void;
    setLoop(loop: boolean): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    getDuration(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideoAt(index: number): void;
    getVideoData(): { title: string; author: string; video_id: string };
    getPlaylist(): string[];
    getPlaylistIndex(): number;
    destroy(): void;
  }
}

interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT?: typeof YT;
}
