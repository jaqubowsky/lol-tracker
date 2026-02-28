"use client";

import { useRef } from "react";
import { importSchema } from "./schema";
import type { Friend, Region } from "@/utils/types";

interface ImportExportProps {
  friends: Friend[];
  onImport: (imported: { puuid: string; gameName: string; tagLine: string; region: Region }[]) => void;
}

export function ImportExport({ friends, onImport }: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = {
      version: 1 as const,
      friends: friends.map((f) => ({
        puuid: f.puuid,
        gameName: f.gameName,
        tagLine: f.tagLine,
        region: f.region ?? "eun1",
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lol-tracker-friends-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        const parsed = importSchema.parse(json);
        const existingPuuids = new Set(friends.map((f) => f.puuid));
        const newFriends = parsed.friends.filter((f) => !existingPuuids.has(f.puuid));
        if (newFriends.length === 0) {
          alert("Wszyscy gracze z pliku są już na liście.");
          return;
        }
        onImport(newFriends);
      } catch {
        alert("Nieprawidłowy plik — upewnij się, że to plik wyeksportowany z tej aplikacji.");
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = "";
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 text-text-muted hover:text-gold-primary text-xs uppercase tracking-wider transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Eksportuj
      </button>
      <span className="text-text-muted/30">|</span>
      <button
        onClick={handleImportClick}
        className="flex items-center gap-1.5 text-text-muted hover:text-gold-primary text-xs uppercase tracking-wider transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Importuj
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
