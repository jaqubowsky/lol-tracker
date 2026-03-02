"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { fetchScoreboard } from "./action";
import { resolveFriend } from "@/components/add-friend-form/action";
import { checkRateLimit } from "@/utils/rate-limit-event";
import { getFriends, addFriend as storageAddFriend } from "@/utils/storage";
import type { ScoreboardData, ScoreboardParticipant, Region, RuneTreeInfo } from "@/utils/types";
import { partyLabel } from "@/utils/format";
import { getTierColorClass } from "@/lib/rank-utils";
import { RuneDetailModal } from "@/components/rune-detail-modal";
import { Tooltip } from "@/components/tooltip";

const DDRAGON_IMG = "https://ddragon.leagueoflegends.com/cdn/img";

interface ScoreboardModalProps {
  matchId: string;
  playerPuuid?: string;
  knownPlayersMap?: Map<string, string>;
  region?: Region;
  onClose: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TeamTable({
  participants,
  teamId,
  ddVersion,
  playerPuuid,
  playerTeamId,
  friendPuuids,
  knownPlayersMap,
  addingPuuid,
  onAdd,
  runeIconMap,
  onRuneClick,
  itemDescMap,
}: {
  participants: ScoreboardParticipant[];
  teamId: number;
  ddVersion: string;
  playerPuuid?: string;
  playerTeamId?: number;
  friendPuuids: Set<string>;
  knownPlayersMap?: Map<string, string>;
  addingPuuid: string | null;
  onAdd: (puuid: string, gameName: string, tagLine: string) => void;
  runeIconMap: Record<number, string>;
  onRuneClick: (p: ScoreboardParticipant) => void;
  itemDescMap: Record<number, string>;
}) {
  const teamPlayers = participants.filter((p) => p.teamId === teamId);
  if (teamPlayers.length === 0) return null;

  const isWin = teamPlayers[0].win;
  const isBlue = teamId === 100;

  // Count known premade partners on the player's team
  const premadeOnTeam = (playerTeamId === teamId && knownPlayersMap)
    ? teamPlayers.filter((p) => p.puuid !== playerPuuid && knownPlayersMap.has(p.puuid))
    : [];
  const premadeCount = premadeOnTeam.length;

  return (
    <div className="mb-4 last:mb-0">
      {/* Team header */}
      <div className="flex items-center gap-2 mb-2 px-2">
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            isBlue ? "text-[#4a9fff]" : "text-[#ff4a4a]"
          }`}
        >
          {isBlue ? "Niebiescy" : "Czerwoni"}
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 ${
            isWin
              ? "bg-win/15 text-win border border-win/30"
              : "bg-loss/15 text-loss border border-loss/30"
          }`}
        >
          {isWin ? "WIN" : "LOSS"}
        </span>
      </div>

      {/* Table */}
      <div>
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="text-text-muted uppercase text-[10px] tracking-wider">
              <th className="text-left py-1.5 px-2 w-[36%]">Gracz</th>
              <th className="text-center py-1.5 px-1 w-[8%]">KDA</th>
              <th className="text-center py-1.5 px-1 hidden sm:table-cell w-[5%]">CS</th>
              <th className="text-center py-1.5 px-1 hidden md:table-cell w-[7%]">DMG</th>
              <th className="text-center py-1.5 px-1 hidden sm:table-cell w-[7%]">Zloto</th>
              <th className="text-center py-1.5 px-1 hidden md:table-cell w-[5%]">Wizja</th>
              <th className="text-center py-1.5 px-1 hidden sm:table-cell">Przedmioty</th>
            </tr>
          </thead>
          <tbody>
            {teamPlayers.map((p, i) => {
              const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
              const displayName = p.riotIdGameName || p.summonerName || "???";
              const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
              const isHighlighted = playerPuuid !== undefined && p.puuid === playerPuuid;
              const isFollowed = friendPuuids.has(p.puuid);
              const isKnownPremade = knownPlayersMap?.has(p.puuid) ?? false;
              const isSelf = p.puuid === playerPuuid;
              const canAdd = !isSelf && !isFollowed;
              const isAdding = addingPuuid === p.puuid;
              const tagLine = p.riotIdTagline || "";
              const isPremade = !isSelf && isKnownPremade && playerTeamId !== undefined && p.teamId === playerTeamId;

              return (
                <tr
                  key={i}
                  className={`border-t border-gold-muted/20 transition-colors ${
                    isHighlighted
                      ? "bg-gold-primary/10 border-l-2 border-l-gold-primary"
                      : isBlue ? "hover:bg-[#4a9fff]/5" : "hover:bg-[#ff4a4a]/5"
                  }`}
                >
                  {/* Champion + spells + name */}
                  <td className="py-1.5 px-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                      {canAdd && (
                        <button
                          onClick={() => onAdd(p.puuid, displayName, tagLine)}
                          disabled={isAdding}
                          className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-gold-dark/40 text-text-muted hover:text-gold-primary hover:border-gold-primary/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                          title={`Dodaj ${displayName}`}
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
                      <div className="relative w-8 h-8 shrink-0 border border-gold-dark/40">
                        <Image
                          src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${p.championName}.png`}
                          alt={p.championName}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                        <span className="absolute -bottom-1 -right-1 bg-bg-primary text-text-secondary text-[8px] font-bold px-1 border border-gold-dark/30 leading-tight">
                          {p.champLevel}
                        </span>
                      </div>
                      {/* Summoner spells */}
                      <div className="flex flex-col gap-[2px] shrink-0">
                        <div className="w-4 h-4 border border-gold-dark/20">
                          {p.spell1Name && p.spell1Name !== "Unknown" && (
                            <Image
                              src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${p.spell1Name}.png`}
                              alt={p.spell1Name}
                              width={16}
                              height={16}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="w-4 h-4 border border-gold-dark/20">
                          {p.spell2Name && p.spell2Name !== "Unknown" && (
                            <Image
                              src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${p.spell2Name}.png`}
                              alt={p.spell2Name}
                              width={16}
                              height={16}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          )}
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
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`truncate text-[11px] font-medium ${
                          isHighlighted ? "text-gold-bright font-bold" : "text-text-primary"
                        }`}>
                          {displayName}
                          {isHighlighted && (
                            <span className="ml-1 text-[8px] text-gold-primary font-normal uppercase tracking-wider">&#x25C0;</span>
                          )}
                        </span>
                        {p.rank && (
                          <span className={`truncate ${getTierColorClass(p.rank.tier)} text-[9px] uppercase tracking-wide font-medium`}>
                            {p.rank.tier} {p.rank.division} · {p.rank.lp} LP
                          </span>
                        )}
                      </div>
                      {isFollowed && !isSelf && (
                        <span className="shrink-0 text-[8px] text-gold-dark uppercase tracking-wider font-medium">
                          obserwujesz
                        </span>
                      )}
                      {isPremade && premadeCount > 0 && (
                        <Tooltip content={partyLabel(premadeCount)} delay={200}>
                          <span className="shrink-0 text-blue-bright">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </td>

                  {/* KDA */}
                  <td className="text-center py-1.5 px-1">
                    <span className="text-win">{p.kills}</span>
                    <span className="text-text-muted">/</span>
                    <span className="text-loss">{p.deaths}</span>
                    <span className="text-text-muted">/</span>
                    <span className="text-text-primary">{p.assists}</span>
                  </td>

                  {/* CS */}
                  <td className="text-center text-text-secondary py-1.5 px-1 hidden sm:table-cell">
                    {cs}
                  </td>

                  {/* Damage */}
                  <td className="text-center text-text-secondary py-1.5 px-1 text-[11px] hidden md:table-cell">
                    {formatNumber(p.totalDamageDealtToChampions)}
                  </td>

                  {/* Gold */}
                  <td className="text-center text-gold-primary py-1.5 px-1 text-[11px] hidden sm:table-cell">
                    {formatNumber(p.goldEarned)}
                  </td>

                  {/* Vision */}
                  <td className="text-center text-text-secondary py-1.5 px-1 hidden md:table-cell">
                    {p.visionScore}
                  </td>

                  {/* Items */}
                  <td className="py-1.5 px-1 hidden sm:table-cell">
                    <div className="flex gap-[2px] justify-center">
                      {items.map((itemId, idx) => {
                        const desc = itemId > 0 ? itemDescMap[itemId] : undefined;
                        const tooltipContent = desc ? (() => {
                          const [name, ...rest] = desc.split("\n");
                          return (
                            <div>
                              <div className="font-bold text-white text-[11px]">{name}</div>
                              {rest.length > 0 && <div className="text-[10px] opacity-80 mt-0.5">{rest.join(" ")}</div>}
                            </div>
                          );
                        })() : null;
                        return (
                        <Tooltip
                          key={idx}
                          content={tooltipContent}
                        >
                          <div className="w-6 h-6 border border-gold-dark/30 bg-bg-primary/60">
                            {itemId > 0 && (
                              <Image
                                src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png`}
                                alt={`Item ${itemId}`}
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            )}
                          </div>
                        </Tooltip>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScoreboardModal({ matchId, playerPuuid, knownPlayersMap, region, onClose }: ScoreboardModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardData | null>(null);
  const [ddVersion, setDdVersion] = useState("");
  const [friendPuuids, setFriendPuuids] = useState<Set<string>>(new Set());
  const [addingPuuid, setAddingPuuid] = useState<string | null>(null);
  const [runeIconMap, setRuneIconMap] = useState<Record<number, string>>({});
  const [runeNameMap, setRuneNameMap] = useState<Record<number, string>>({});
  const [runeTreesData, setRuneTreesData] = useState<Record<number, RuneTreeInfo>>({});
  const [itemDescMap, setItemDescMap] = useState<Record<number, string>>({});
  const [runePlayer, setRunePlayer] = useState<ScoreboardParticipant | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Load current friend list to know who's already followed
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

  // Fetch data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchScoreboard(matchId, region);
        if (cancelled) return;
        setScoreboard(result.data);
        setDdVersion(result.ddVersion);
        setRuneIconMap(result.runeIconMap);
        setRuneNameMap(result.runeNameMap);
        setRuneTreesData(result.runeTreesData);
        setItemDescMap(result.itemDescMap);
      } catch (err) {
        checkRateLimit(err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Błąd pobierania danych");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const playerTeamId = scoreboard && playerPuuid
    ? scoreboard.participants.find((p) => p.puuid === playerPuuid)?.teamId
    : undefined;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 scoreboard-backdrop"
      style={{ backgroundColor: "rgba(1, 10, 19, 0.85)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="scoreboard-panel bg-bg-secondary border border-gold-dark/50 w-full max-w-[820px] max-h-[90vh] overflow-y-auto hex-clip-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-gold-dark/30">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2
              className="text-gold-bright text-xs sm:text-sm font-bold uppercase tracking-wider"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tablica wynikow
            </h2>
            {scoreboard && (
              <span className="text-text-muted text-[11px]">
                {scoreboard.gameMode} &middot; {formatDuration(scoreboard.gameDuration)}
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
        <div className="p-2 sm:p-4">
          {loading && (
            <div className="space-y-3 py-8">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 bg-bg-surface/50 animate-pulse" />
                  <div className="h-3 w-24 bg-bg-surface/50 animate-pulse" />
                  <div className="h-3 w-16 bg-bg-surface/50 animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-danger text-xs tracking-wider uppercase">{error}</p>
            </div>
          )}

          {scoreboard && ddVersion && (
            <>
              <TeamTable
                participants={scoreboard.participants}
                teamId={100}

                ddVersion={ddVersion}
                playerPuuid={playerPuuid}
                playerTeamId={playerTeamId}
                friendPuuids={friendPuuids}
                knownPlayersMap={knownPlayersMap}
                addingPuuid={addingPuuid}
                onAdd={handleAddFriend}
                runeIconMap={runeIconMap}
                onRuneClick={setRunePlayer}
                itemDescMap={itemDescMap}
              />
              <div className="lol-divider my-3" />
              <TeamTable
                participants={scoreboard.participants}
                teamId={200}

                ddVersion={ddVersion}
                playerPuuid={playerPuuid}
                playerTeamId={playerTeamId}
                friendPuuids={friendPuuids}
                knownPlayersMap={knownPlayersMap}
                addingPuuid={addingPuuid}
                onAdd={handleAddFriend}
                runeIconMap={runeIconMap}
                onRuneClick={setRunePlayer}
                itemDescMap={itemDescMap}
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
          playerName={runePlayer.riotIdGameName || runePlayer.summonerName || "???"}
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
