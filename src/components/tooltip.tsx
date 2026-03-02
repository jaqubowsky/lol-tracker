"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
}

export function Tooltip({ content, children, delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
      timeoutRef.current = setTimeout(() => setVisible(true), delay);
    },
    [delay]
  );

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  if (!content) return <>{children}</>;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && mounted && createPortal(
        <div
          className="fixed z-[200] pointer-events-none"
          style={{
            left: Math.max(8, Math.min(position.x, window.innerWidth - 8)),
            top: position.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            className="px-2.5 py-1.5 rounded text-[11px] leading-relaxed max-w-[220px] text-center"
            style={{
              background: "linear-gradient(180deg, rgba(10, 18, 36, 0.97), rgba(5, 10, 22, 0.99))",
              border: "1px solid rgba(200, 170, 110, 0.25)",
              color: "#c4b998",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
            }}
          >
            {content}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
