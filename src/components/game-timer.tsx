"use client";

import { useEffect, useState } from "react";

interface GameTimerProps {
  gameStartTime: number;
}

export function GameTimer({ gameStartTime }: GameTimerProps) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - gameStartTime) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - gameStartTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStartTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <span className="font-semibold text-blue-bright text-xs tracking-widest tabular-nums">
      {formatted}
    </span>
  );
}
