"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { Tooltip } from "@/components/tooltip";
import type { ParticipantPerks, RuneTreeInfo } from "@/utils/types";

const DDRAGON_IMG = "https://ddragon.leagueoflegends.com/cdn/img";


interface RuneDetailModalProps {
  playerName: string;
  championName: string;
  perks: ParticipantPerks;
  runeIconMap: Record<number, string>;
  runeNameMap: Record<number, string>;
  runeTreesData: Record<number, RuneTreeInfo>;
  ddVersion: string;
  onClose: () => void;
}

function RuneCircle({
  runeId,
  icon,
  name,
  desc,
  selected,
  size,
  isKeystone,
}: {
  runeId: number;
  icon: string;
  name: string;
  desc?: string;
  selected: boolean;
  size: number;
  isKeystone?: boolean;
}) {
  const imgSrc = `${DDRAGON_IMG}/${icon}`;
  const tooltipContent = desc ? (
    <div>
      <div className="font-bold text-white text-[11px] mb-0.5">{name}</div>
      <div className="text-[10px] leading-snug opacity-80">{desc}</div>
    </div>
  ) : name;

  const outerSize = size + (isKeystone && selected ? 8 : 4);

  return (
    <Tooltip content={tooltipContent} delay={200}>
      <div
        className="rounded-full flex items-center justify-center transition-all duration-200 shrink-0"
        style={{
          width: outerSize,
          height: outerSize,
          background: selected
            ? isKeystone
              ? "linear-gradient(135deg, rgba(200, 170, 110, 0.35), rgba(200, 170, 110, 0.12))"
              : "rgba(60, 70, 100, 0.35)"
            : "rgba(20, 25, 40, 0.4)",
          boxShadow: selected && isKeystone
            ? "0 0 12px rgba(200, 170, 110, 0.2)"
            : "none",
          border: selected
            ? isKeystone
              ? "1.5px solid rgba(200, 170, 110, 0.5)"
              : "1.5px solid rgba(100, 120, 170, 0.4)"
            : "1.5px solid rgba(40, 45, 60, 0.4)",
        }}
      >
        <Image
          src={imgSrc}
          alt={name}
          width={size}
          height={size}
          className="rounded-full"
          style={{
            opacity: selected ? 1 : 0.3,
            filter: selected ? "none" : "grayscale(1)",
          }}
          unoptimized
        />
      </div>
    </Tooltip>
  );
}


function TreePanel({
  tree,
  selectedIds,
  isSecondary,
}: {
  tree: RuneTreeInfo;
  selectedIds: Set<number>;
  isSecondary: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Tree icon */}
      <div className="mb-2">
        <Image
          src={`${DDRAGON_IMG}/${tree.icon}`}
          alt={tree.name}
          width={28}
          height={28}
          className="opacity-90"
          unoptimized
        />
      </div>

      {/* Slots */}
      <div className="flex flex-col gap-2">
        {tree.slots.map((slot, slotIdx) => {
          // Secondary tree: skip keystone row (slot 0)
          if (isSecondary && slotIdx === 0) return null;

          const isKeystoneRow = slotIdx === 0 && !isSecondary;

          return (
            <div key={slotIdx} className="flex items-center justify-center gap-1.5">
              {slot.runes.map((rune) => (
                <RuneCircle
                  key={rune.id}
                  runeId={rune.id}
                  icon={rune.icon}
                  name={rune.name}
                  desc={rune.shortDesc}
                  selected={selectedIds.has(rune.id)}
                  size={isKeystoneRow ? 34 : 26}
                  isKeystone={isKeystoneRow}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RuneDetailModal({
  playerName,
  championName,
  perks,
  runeIconMap,
  runeNameMap,
  runeTreesData,
  ddVersion,
  onClose,
}: RuneDetailModalProps) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  // Escape closes ONLY this modal (capture phase)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [handleClose]);

  const primaryTree = runeTreesData[perks.primaryStyleId];
  const subTree = runeTreesData[perks.subStyleId];

  const selectedIds = new Set([
    ...perks.primarySelections,
    ...perks.subSelections,
  ]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(1, 10, 19, 0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-[380px] overflow-hidden rounded-lg"
        style={{
          background: "linear-gradient(180deg, rgba(10, 18, 36, 0.97) 0%, rgba(5, 10, 22, 0.99) 100%)",
          border: "1px solid rgba(50, 60, 90, 0.5)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 1px rgba(100, 120, 180, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden border border-[#3a3a5c]/50">
            <Image
              src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${championName}.png`}
              alt={championName}
              width={40}
              height={40}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white text-sm font-bold truncate leading-tight">
              {playerName}
            </h3>
            <p className="text-[#7a8ba5] text-[11px]">{championName}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-[#5a6a80] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px mx-3" style={{ background: "linear-gradient(90deg, transparent, rgba(50, 60, 90, 0.5), transparent)" }} />

        {/* Rune trees — side by side */}
        <div className="px-4 py-4">
          {primaryTree && subTree ? (
            <div className="flex items-start justify-center gap-6">
              {/* Primary tree */}
              <div>
                <div className="text-center mb-1">
                  <span className="text-[#c8aa6e] text-[9px] font-bold uppercase tracking-[0.15em]">
                    Główne
                  </span>
                </div>
                <TreePanel tree={primaryTree} selectedIds={selectedIds} isSecondary={false} />
              </div>

              {/* Vertical divider */}
              <div
                className="w-px self-stretch my-4"
                style={{ background: "linear-gradient(180deg, transparent, rgba(50, 60, 90, 0.4), transparent)" }}
              />

              {/* Secondary tree */}
              <div>
                <div className="text-center mb-1">
                  <span className="text-[#c8aa6e] text-[9px] font-bold uppercase tracking-[0.15em]">
                    Poboczne
                  </span>
                </div>
                <TreePanel tree={subTree} selectedIds={selectedIds} isSecondary={true} />
              </div>
            </div>
          ) : (
            /* Fallback: just list selected runes */
            <div className="text-center text-text-muted text-xs">
              Brak danych drzewa run
            </div>
          )}
        </div>

        {/* Bottom padding */}
        <div className="pb-2" />
      </div>
    </div>
  );
}
