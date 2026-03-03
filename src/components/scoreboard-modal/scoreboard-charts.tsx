"use client";

import { useRef, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type Plugin,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { ScoreboardParticipant } from "@/utils/types";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export type ChartMetric = "damage" | "gold" | "vision" | "cs" | "postScore";

interface ScoreboardChartProps {
  participants: ScoreboardParticipant[];
  metric: ChartMetric;
  playerPuuid?: string;
  ddVersion: string;
}

function getMetricValue(p: ScoreboardParticipant, metric: ChartMetric): number {
  switch (metric) {
    case "damage":
      return p.totalDamageDealtToChampions;
    case "gold":
      return p.goldEarned;
    case "vision":
      return p.visionScore;
    case "cs":
      return p.totalMinionsKilled + p.neutralMinionsKilled;
    case "postScore":
      return p.postScore;
  }
}

function formatMetricValue(value: number, metric: ChartMetric): string {
  if (metric === "postScore") return value.toFixed(1);
  if (metric === "damage" || metric === "gold")
    return value.toLocaleString("pl-PL");
  return String(value);
}

const BLUE_BG = "rgba(74, 159, 255, 0.6)";
const BLUE_BORDER = "rgba(74, 159, 255, 1)";
const RED_BG = "rgba(255, 74, 74, 0.6)";
const RED_BORDER = "rgba(255, 74, 74, 1)";
const GOLD_BG = "rgba(255, 185, 40, 0.8)";
const GOLD_BORDER = "rgba(255, 185, 40, 1)";

const ICON_SIZE = 26;

export function ScoreboardChart({
  participants,
  metric,
  playerPuuid,
  ddVersion,
}: ScoreboardChartProps) {
  const sorted = useMemo(
    () =>
      [...participants].sort(
        (a, b) => getMetricValue(b, metric) - getMetricValue(a, metric)
      ),
    [participants, metric]
  );

  // Keep a ref that always points to the latest sorted array
  // so the plugin always reads the current order
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  const labels = sorted.map(
    (p) => p.riotIdGameName || p.summonerName || "???"
  );
  const values = sorted.map((p) => getMetricValue(p, metric));

  const backgroundColors = sorted.map((p) => {
    if (playerPuuid && p.puuid === playerPuuid) return GOLD_BG;
    return p.teamId === 100 ? BLUE_BG : RED_BG;
  });

  const borderColors = sorted.map((p) => {
    if (playerPuuid && p.puuid === playerPuuid) return GOLD_BORDER;
    return p.teamId === 100 ? BLUE_BORDER : RED_BORDER;
  });

  // Preload champion icons
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const chartRef = useRef<ChartJS<"bar"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cache = imgCacheRef.current;
    let loaded = 0;
    const total = sorted.length;

    sorted.forEach((p) => {
      if (cache.has(p.championName)) {
        loaded++;
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${p.championName}.png`;
      img.onload = () => {
        if (cancelled) return;
        cache.set(p.championName, img);
        loaded++;
        if (loaded === total) {
          chartRef.current?.draw();
        }
      };
    });

    return () => {
      cancelled = true;
    };
  }, [sorted, ddVersion]);

  // Plugin that draws champion icons to the left of Y-axis labels.
  // Uses sortedRef so it always reads the current metric's sort order.
  const champIconPlugin: Plugin<"bar"> = useMemo(
    () => ({
      id: "champIcons",
      afterDraw(chart) {
        const yScale = chart.scales.y;
        if (!yScale) return;
        const ctx = chart.ctx;
        const currentSorted = sortedRef.current;

        yScale.ticks.forEach((_tick: unknown, index: number) => {
          const participant = currentSorted[index];
          if (!participant) return;
          const img = imgCacheRef.current.get(participant.championName);
          if (!img) return;

          const y = yScale.getPixelForTick(index);
          const labelWidth = yScale.width;
          const x = labelWidth - ICON_SIZE - 4;

          ctx.save();
          ctx.drawImage(img, x, y - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
          ctx.restore();
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: { left: 1, top: 0, right: 0, bottom: 0 },
        borderSkipped: false as const,
        barThickness: 24,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { left: 4, top: 8, bottom: 8 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown }) =>
            formatMetricValue(ctx.raw as number, metric),
        },
        backgroundColor: "#0a1628",
        titleColor: "#c89b3c",
        bodyColor: "#a09b8c",
        borderColor: "rgba(200,155,60,0.3)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(200,155,60,0.08)" },
        ticks: { color: "#5b5a56", font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: "#a09b8c",
          font: { size: 12 },
          padding: ICON_SIZE + 10,
        },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ height: "460px" }}>
      <Bar
        ref={chartRef}
        data={data}
        options={options}
        plugins={[champIconPlugin]}
      />
    </div>
  );
}
