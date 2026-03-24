import { db } from "@/lib/db";

/** Comma-separated station IDs in env (e.g. Vercel) for quick blocks without DB. */
function hiddenIdsFromEnv(): string[] {
  const raw = process.env.HIDDEN_STATION_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function loadHiddenStationIds(): Promise<Set<string>> {
  const ids = new Set<string>(hiddenIdsFromEnv());
  try {
    const rows = await db.hiddenStation.findMany({ select: { stationId: true } });
    for (const r of rows) ids.add(r.stationId);
  } catch {
    // DB unavailable or schema not migrated yet — env list still applies.
  }
  return ids;
}

export function filterOutHiddenStations<T extends { id: string }>(
  stations: T[],
  hidden: Set<string>
): T[] {
  if (!hidden.size) return stations;
  return stations.filter((s) => !hidden.has(s.id));
}
