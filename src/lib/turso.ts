import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let schemaReady = false;

function getClient(): Client | null {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;

  client = createClient({ url, authToken });
  return client;
}

async function ensureSchema(db: Client): Promise<void> {
  if (schemaReady) return;

  await db.batch([
    `CREATE TABLE IF NOT EXISTS match_cache (
      match_id   TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS ddragon_cache (
      cache_key  TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      version    TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS player_matches (
      puuid          TEXT NOT NULL,
      match_id       TEXT NOT NULL,
      queue_id       INTEGER NOT NULL DEFAULT 0,
      game_creation  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (puuid, match_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_player_matches_lookup
       ON player_matches(puuid, game_creation DESC)`,
  ]);
  schemaReady = true;
}

export async function getCachedMatch(matchId: string): Promise<string | null> {
  try {
    const db = getClient();
    if (!db) return null;
    await ensureSchema(db);

    const result = await db.execute({
      sql: "SELECT data FROM match_cache WHERE match_id = ?",
      args: [matchId],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0].data as string;
  } catch {
    return null;
  }
}

export async function getCachedMatchBatch(
  matchIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const db = getClient();
    if (!db || matchIds.length === 0) return result;
    await ensureSchema(db);

    // Query in chunks of 50 to avoid overly large IN clauses
    const CHUNK = 50;
    for (let i = 0; i < matchIds.length; i += CHUNK) {
      const chunk = matchIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "?").join(",");
      const res = await db.execute({
        sql: `SELECT match_id, data FROM match_cache WHERE match_id IN (${placeholders})`,
        args: chunk,
      });
      for (const row of res.rows) {
        result.set(row.match_id as string, row.data as string);
      }
    }
  } catch {
    // silent — return whatever we got
  }
  return result;
}

export async function setCachedMatch(
  matchId: string,
  data: string
): Promise<void> {
  try {
    const db = getClient();
    if (!db) return;
    await ensureSchema(db);

    await db.execute({
      sql: "INSERT OR REPLACE INTO match_cache (match_id, data) VALUES (?, ?)",
      args: [matchId, data],
    });
  } catch {
    // silent — cache is best-effort
  }
}

export async function getCachedDdragon(key: string): Promise<string | null> {
  try {
    const db = getClient();
    if (!db) return null;
    await ensureSchema(db);

    const result = await db.execute({
      sql: "SELECT data FROM ddragon_cache WHERE cache_key = ?",
      args: [key],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0].data as string;
  } catch {
    return null;
  }
}

export async function setCachedDdragon(
  key: string,
  version: string,
  data: string
): Promise<void> {
  try {
    const db = getClient();
    if (!db) return;
    await ensureSchema(db);

    await db.execute({
      sql: "INSERT OR REPLACE INTO ddragon_cache (cache_key, data, version) VALUES (?, ?, ?)",
      args: [key, data, version],
    });
  } catch {
    // silent — cache is best-effort
  }
}

// ---------------------------------------------------------------------------
// Player match index — accumulates match IDs across visits
// ---------------------------------------------------------------------------

export interface PlayerMatchEntry {
  puuid: string;
  matchId: string;
  queueId: number;
  gameCreation: number;
}

export async function getPlayerMatchIds(
  puuid: string,
  opts: { queueId?: number; startTime?: number; endTime?: number } = {}
): Promise<PlayerMatchEntry[]> {
  try {
    const db = getClient();
    if (!db) return [];
    await ensureSchema(db);

    let sql = "SELECT match_id, queue_id, game_creation FROM player_matches WHERE puuid = ?";
    const args: (string | number)[] = [puuid];

    if (opts.queueId !== undefined) {
      sql += " AND queue_id = ?";
      args.push(opts.queueId);
    }
    if (opts.startTime !== undefined) {
      sql += " AND game_creation >= ?";
      args.push(opts.startTime * 1000); // stored as ms
    }
    if (opts.endTime !== undefined) {
      sql += " AND game_creation <= ?";
      args.push(opts.endTime * 1000);
    }

    sql += " ORDER BY game_creation DESC LIMIT 200";

    const result = await db.execute({ sql, args });
    return result.rows.map((r) => ({
      puuid,
      matchId: r.match_id as string,
      queueId: r.queue_id as number,
      gameCreation: r.game_creation as number,
    }));
  } catch {
    return [];
  }
}

export async function savePlayerMatches(
  entries: PlayerMatchEntry[]
): Promise<void> {
  try {
    const db = getClient();
    if (!db || entries.length === 0) return;
    await ensureSchema(db);

    // Batch insert in chunks of 20 to stay within Turso batch limits
    const CHUNK = 20;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      await db.batch(
        chunk.map((e) => ({
          sql: "INSERT OR IGNORE INTO player_matches (puuid, match_id, queue_id, game_creation) VALUES (?, ?, ?, ?)",
          args: [e.puuid, e.matchId, e.queueId, e.gameCreation],
        }))
      );
    }
  } catch {
    // silent
  }
}
