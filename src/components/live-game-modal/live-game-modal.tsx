"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { fetchLiveGame } from "./action";
import { resolveFriend } from "@/components/add-friend-form/action";
import { checkRateLimit } from "@/utils/rate-limit-event";
import { getFriends, addFriend as storageAddFriend } from "@/utils/storage";
import { GameTimer } from "@/components/game-timer";
import { getTierColorClass } from "@/lib/rank-utils";
import type { LiveGameData, LiveGameParticipant, Region, RuneTreeInfo } from "@/utils/types";
import { RuneDetailModal } from "@/components/rune-detail-modal";

const DDRAGON_IMG = "https://ddragon.leagueoflegends.com/cdn/img";

interface LiveGameModalProps {
  puuid: string;
  region: Region;
  onClose: () => void;
}

function getRankText(p: LiveGameParticipant): string {
  if (!p.rank) return "Unranked";
  return `${p.rank.tier} ${p.rank.division} — ${p.rank.lp} LP`;
}

function getRankColor(p: LiveGameParticipant): string {
  return getTierColorClass(p.rank?.tier);
}

function TeamSection({
  participants,
  teamId,
  ddVersion,
  friendPuuids,
  viewedPuuid,
  addingPuuid,
  onAdd,
  runeIconMap,
  onRuneClick,
}: {
  participants: LiveGameParticipant[];
  teamId: number;
  ddVersion: string;
  friendPuuids: Set<string>;
  viewedPuuid: string;
  addingPuuid: string | null;
  onAdd: (puuid: string, gameName: string, tagLine: string) => void;
  runeIconMap: Record<number, string>;
  onRuneClick: (p: LiveGameParticipant) => void;
}) {
  const team = participants.filter((p) => p.teamId === teamId);
  if (team.length === 0) return null;
  const isBlue = teamId === 100;

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2 px-2">
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            isBlue ? "text-[#4a9fff]" : "text-[#ff4a4a]"
          }`}
        >
          {isBlue ? "Niebiescy" : "Czerwoni"}
        </span>
      </div>

      <div className="space-y-[2px]">
        {team.map((p) => {
          const isViewed = p.puuid === viewedPuuid;
          const isFriend = friendPuuids.has(p.puuid);
          const canAdd = !isViewed && !isFriend;
          const isAdding = addingPuuid === p.puuid;

          return (
            <div
              key={p.puuid}
              className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 transition-colors ${
                isViewed
                  ? "bg-gold-primary/10 border-l-2 border-l-gold-primary"
                  : isFriend
                    ? "bg-blue-dark/10 border-l-2 border-l-blue-primary/40"
                    : isBlue
                      ? "hover:bg-[#4a9fff]/5 border-l-2 border-l-transparent"
                      : "hover:bg-[#ff4a4a]/5 border-l-2 border-l-transparent"
              }`}
            >
              {/* Add button */}
              {canAdd && (
                <button
                  onClick={() => onAdd(p.puuid, p.gameName, p.tagLine)}
                  disabled={isAdding}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-gold-dark/40 text-text-muted hover:text-gold-primary hover:border-gold-primary/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  title={`Dodaj ${p.gameName}`}
                >
                  {isAdding ? (
                    <div className="w-2.5 h-2.5 border border-gold-dark border-t-gold-primary rounded-full animate-spin" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  )}
                </button>
              )}

              {/* Champion icon */}
              <div className="w-9 h-9 shrink-0 border border-gold-dark/30">
                <Image
                  src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${p.championName}.png`}
                  alt={p.championName}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>

              {/* Spells */}
              <div className="flex flex-col gap-[2px] shrink-0">
                <div className="w-4 h-4 border border-gold-dark/20">
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${p.spell1Name}.png`}
                    alt={p.spell1Name}
                    width={16}
                    height={16}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="w-4 h-4 border border-gold-dark/20">
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${p.spell2Name}.png`}
                    alt={p.spell2Name}
                    width={16}
                    height={16}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              </div>

              {/* Rune button (keystone) */}
              {p.perks && p.perks.primarySelections[0] !== undefined && runeIconMap[p.perks.primarySelections[0]] && (
                <button
                  onClick={() => onRuneClick(p)}
                  className="shrink-0 w-5 h-5 rounded-full border border-gold-dark/30 hover:border-gold-primary/60 transition-colors cursor-pointer overflow-hidden"
                  title="Pokaż runy"
                >
                  <Image
                    src={`${DDRAGON_IMG}/${runeIconMap[p.perks.primarySelections[0]]}`}
                    alt="Runy"
                    width={20}
                    height={20}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </button>
              )}

              {/* Name + champion */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium truncate ${
                      isViewed ? "text-gold-bright font-bold" : "text-text-primary"
                    }`}
                  >
                    {p.gameName}
                  </span>
                  <span className="text-text-muted text-[10px]">#{p.tagLine}</span>
                  {isViewed && (
                    <span className="text-[8px] text-gold-primary uppercase tracking-wider">&#x25C0;</span>
                  )}
                  {isFriend && !isViewed && (
                    <span className="shrink-0 text-[8px] text-gold-dark uppercase tracking-wider font-medium">
                      obserwujesz
                    </span>
                  )}
                </div>
                <span className="text-text-muted text-[10px]">{p.championName}</span>
              </div>

              {/* Rank */}
              <span className={`text-[10px] sm:text-[11px] shrink-0 font-medium uppercase tracking-wide hidden sm:block ${getRankColor(p)}`}>
                {getRankText(p)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LiveGameModal({ puuid, region, onClose }: LiveGameModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<LiveGameData | null>(null);
  const [ddVersion, setDdVersion] = useState("");
  const [friendPuuids, setFriendPuuids] = useState<Set<string>>(new Set());
  const [addingPuuid, setAddingPuuid] = useState<string | null>(null);
  const [runeIconMap, setRuneIconMap] = useState<Record<number, string>>({});
  const [runeNameMap, setRuneNameMap] = useState<Record<number, string>>({});
  const [runeTreesData, setRuneTreesData] = useState<Record<number, RuneTreeInfo>>({});
  const [runePlayer, setRunePlayer] = useState<LiveGameParticipant | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const friends = getFriends();
    setFriendPuuids(new Set(friends.map((f) => f.puuid)));
  }, []);

  const handleAddFriend = useCallback(async (puuid: string, gameName: string, tagLine: string) => {
    if (!gameName || !tagLine) return;
    setAddingPuuid(puuid);
    try {
      const friend = await resolveFriend(gameName, tagLine);
      storageAddFriend(friend);
      setFriendPuuids((prev) => new Set([...prev, puuid]));
    } catch (err) {
      checkRateLimit(err);
    } finally {
      setAddingPuuid(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchLiveGame(puuid, region);
        if (cancelled) return;
        if (!result) {
          setError("Gracz nie jest aktualnie w grze");
          return;
        }
        setGame(result.data);
        setDdVersion(result.ddVersion);
        setRuneIconMap(result.runeIconMap);
        setRuneNameMap(result.runeNameMap);
        setRuneTreesData(result.runeTreesData);
      } catch (err) {
        checkRateLimit(err);
        if (!cancelled) setError("Nie udało się pobrać danych o grze");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [puuid, region]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(1, 10, 19, 0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-bg-secondary border border-gold-dark/50 w-full max-w-[700px] max-h-[90vh] overflow-y-auto hex-clip-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-gold-dark/30">
          <div className="flex items-center gap-3">
            <h2
              className="text-gold-bright text-sm font-bold uppercase tracking-wider"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Gra na żywo
            </h2>
            {game && (
              <span className="text-text-muted text-[11px] flex items-center gap-2">
                {game.gameMode}
                <span className="text-blue-bright">
                  <GameTimer gameStartTime={game.gameStartTime} />
                </span>
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-gold-primary transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-gold-dark border-t-gold-primary rounded-full animate-spin" />
              <p className="text-text-muted text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
                Pobieranie danych...
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-danger text-xs tracking-wider uppercase">{error}</p>
            </div>
          )}

          {game && ddVersion && (
            <>
              <TeamSection
                participants={game.participants}
                teamId={100}
                ddVersion={ddVersion}
                friendPuuids={friendPuuids}
                viewedPuuid={puuid}
                addingPuuid={addingPuuid}
                onAdd={handleAddFriend}
                runeIconMap={runeIconMap}
                onRuneClick={setRunePlayer}
              />
              <div className="lol-divider my-3" />
              <TeamSection
                participants={game.participants}
                teamId={200}
                ddVersion={ddVersion}
                friendPuuids={friendPuuids}
                viewedPuuid={puuid}
                addingPuuid={addingPuuid}
                onAdd={handleAddFriend}
                runeIconMap={runeIconMap}
                onRuneClick={setRunePlayer}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(
    <>
      {content}
      {runePlayer && runePlayer.perks && ddVersion && (
        <RuneDetailModal
          playerName={runePlayer.gameName}
          championName={runePlayer.championName}
          perks={runePlayer.perks}
          runeIconMap={runeIconMap}
          runeNameMap={runeNameMap}
          runeTreesData={runeTreesData}
          ddVersion={ddVersion}
          onClose={() => setRunePlayer(null)}
        />
      )}
    </>,
    document.body
  );
}
