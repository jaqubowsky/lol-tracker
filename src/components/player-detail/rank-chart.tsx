"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { RankDataPoint } from "@/utils/types";
import { rankToValue, valueToRank, getTierLabel, getTierColor, getTierColorClass, TIERS } from "@/lib/rank-utils";

interface RankChartProps {
  dataPoints: RankDataPoint[];
  friendMap?: Map<string, string>;
  onMatchClick?: (matchId: string) => void;
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 300;
const PADDING = { top: 20, right: 20, bottom: 30, left: 70 };
const INNER_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

export function RankChart({ dataPoints, friendMap, onMatchClick }: RankChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Dismiss tooltip when tapping outside on mobile
  useEffect(() => {
    if (!isMobile || hoveredIndex === null) return;
    function handleTouchOutside(e: TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHoveredIndex(null);
      }
    }
    document.addEventListener("touchstart", handleTouchOutside);
    return () => document.removeEventListener("touchstart", handleTouchOutside);
  }, [isMobile, hoveredIndex]);

  const { minValue, maxValue, tierBoundaries, xScale, yScale, points } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { minValue: 0, maxValue: 400, tierBoundaries: [], xScale: () => 0, yScale: () => 0, points: [] };
    }

    const values = dataPoints.map((d) => d.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.15, 50);
    const yMin = Math.max(0, rawMin - padding);
    const yMax = rawMax + padding;

    // Generate tier boundaries within the visible range
    const boundaries: { value: number; tier: string; division: string }[] = [];
    for (let v = 0; v <= yMax + 100; v += 100) {
      if (v >= yMin && v <= yMax) {
        const rank = valueToRank(v);
        boundaries.push({ value: v, tier: rank.tier, division: rank.division });
      }
    }

    const scaleX = (index: number) =>
      PADDING.left + (index / Math.max(dataPoints.length - 1, 1)) * INNER_WIDTH;
    const scaleY = (value: number) =>
      PADDING.top + INNER_HEIGHT - ((value - yMin) / (yMax - yMin)) * INNER_HEIGHT;

    const pts = dataPoints.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.value),
      data: d,
    }));

    return {
      minValue: yMin,
      maxValue: yMax,
      tierBoundaries: boundaries,
      xScale: scaleX,
      yScale: scaleY,
      points: pts,
    };
  }, [dataPoints]);

  const handlePointInteraction = useCallback((index: number) => {
    if (isMobile) {
      // Toggle on tap — tap same dot again to dismiss
      setHoveredIndex((prev) => (prev === index ? null : index));
    } else {
      setHoveredIndex(index);
    }
  }, [isMobile]);

  const handleSvgTouch = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * CHART_WIDTH;
    const y = ((touch.clientY - rect.top) / rect.height) * CHART_HEIGHT;

    // Find closest point
    let closest = -1;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - x;
      const dy = points[i].y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    // Only select if within reasonable radius (scaled to viewBox)
    if (closest >= 0 && closestDist < 40) {
      e.preventDefault();
      setHoveredIndex((prev) => (prev === closest ? null : closest));
    } else {
      setHoveredIndex(null);
    }
  }, [points]);

  if (dataPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] border border-gold-dark/20 bg-bg-secondary/30 rounded">
        <p className="text-text-muted text-sm">Brak danych do wyświetlenia</p>
      </div>
    );
  }

  // Build polyline path
  const polylinePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Gradient fill area (line down to bottom)
  const areaPath = `${polylinePath} L ${points[points.length - 1].x} ${PADDING.top + INNER_HEIGHT} L ${points[0].x} ${PADDING.top + INNER_HEIGHT} Z`;

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  // Tooltip positioning — keep within bounds
  const tooltipLeft = hoveredPoint
    ? Math.max(10, Math.min(90, (hoveredPoint.x / CHART_WIDTH) * 100))
    : 0;

  return (
    <div className="rank-chart-container relative" ref={containerRef}>
      {/* Mobile rotate hint */}
      <div className="flex sm:hidden items-center justify-center gap-1.5 mb-2 text-text-muted text-[10px] uppercase tracking-wider">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span>Obróć ekran dla lepszego widoku</span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto touch-none"
        onMouseLeave={() => { if (!isMobile) setHoveredIndex(null); }}
        onTouchStart={handleSvgTouch}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8aa6e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#c8aa6e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Tier boundary grid lines */}
        {tierBoundaries.map((b, i) => {
          const y = PADDING.top + INNER_HEIGHT - ((b.value - minValue) / (maxValue - minValue)) * INNER_HEIGHT;
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + INNER_WIDTH}
                y2={y}
                stroke={getTierColor(b.tier)}
                strokeOpacity={0.2}
                strokeDasharray="4 4"
              />
              <text
                x={PADDING.left - 8}
                y={y + 3}
                textAnchor="end"
                fill={getTierColor(b.tier)}
                fontSize="10"
                fontFamily="var(--font-body)"
                opacity={0.7}
              >
                {getTierLabel(b.tier)} {b.division}
              </text>
            </g>
          );
        })}

        {/* Gradient fill */}
        <path d={areaPath} fill="url(#chartGradient)" />

        {/* Main line */}
        <path
          d={polylinePath}
          fill="none"
          stroke="#c8aa6e"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3}
            fill={p.data.match.win ? "var(--color-win)" : "var(--color-loss)"}
            stroke={hoveredIndex === i ? "#fff" : "none"}
            strokeWidth={1.5}
            className="transition-all duration-150"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => handlePointInteraction(i)}
            onClick={() => onMatchClick?.(p.data.match.matchId)}
          />
        ))}

        {/* Invisible hover zones for easier targeting */}
        {points.map((p, i) => (
          <rect
            key={`hover-${i}`}
            x={p.x - (INNER_WIDTH / points.length) / 2}
            y={PADDING.top}
            width={INNER_WIDTH / points.length}
            height={INNER_HEIGHT}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => { if (!isMobile) handlePointInteraction(i); }}
            onClick={() => onMatchClick?.(points[i].data.match.matchId)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="rank-chart-tooltip"
          style={{
            left: `${tooltipLeft}%`,
            top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${hoveredPoint.data.match.win ? "text-win" : "text-loss"}`}>
              {hoveredPoint.data.match.win ? "W" : "L"}
            </span>
            <span className="text-gold-bright text-xs font-semibold">
              {hoveredPoint.data.match.championName}
            </span>
          </div>
          <div className="text-text-secondary text-[10px]">
            {hoveredPoint.data.match.kills}/{hoveredPoint.data.match.deaths}/{hoveredPoint.data.match.assists}
          </div>
          <div className={`${getTierColorClass(hoveredPoint.data.tier)} text-[10px] font-medium`}>
            {hoveredPoint.data.tier} {hoveredPoint.data.division} — {hoveredPoint.data.lp} LP
          </div>
          <div className="text-text-muted text-[10px]">
            {new Date(hoveredPoint.data.match.gameCreation).toLocaleDateString("pl-PL")}
          </div>
          {friendMap && hoveredPoint.data.match.teammatePuuids && (() => {
            const duos = hoveredPoint.data.match.teammatePuuids
              .map((p: string) => friendMap.get(p))
              .filter(Boolean);
            if (duos.length === 0) return null;
            const label = duos.length >= 4 ? "Pełna drużyna" : duos.length === 3 ? "4-man" : duos.length === 2 ? "Trio" : "Duo";
            return (
              <div className="text-blue-bright text-[10px] mt-0.5 flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {label} — {duos.join(", ")}
              </div>
            );
          })()}

          {/* Tap to view hint on mobile */}
          {isMobile && onMatchClick && (
            <button
              className="mt-1.5 text-gold-primary text-[10px] uppercase tracking-wider cursor-pointer"
              onClick={() => onMatchClick(hoveredPoint.data.match.matchId)}
            >
              Zobacz mecz &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
