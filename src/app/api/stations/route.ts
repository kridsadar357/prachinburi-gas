import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { filterOutHiddenStations, loadHiddenStationIds } from "@/lib/hidden-stations";

const STATIONS_API_URL =
  "https://www.thaipumpradar.com/api/provinces/ปราจีนบุรี/stations";
const PROVINCE_NAME = "ปราจีนบุรี";
const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SYNC_TTL_MS = 5 * 60 * 1000;

const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const FuelStatusSchema = z.enum([
  "available",
  "limited",
  "out",
  "pending_delivery",
  "unknown",
]);

/** thaipumpradar.com uses D/G95/…; older code expected diesel/benzineG95. */
const UpstreamLatestReportSchema = z
  .object({
    diesel: FuelStatusSchema.optional(),
    dieselB20: FuelStatusSchema.optional(),
    benzineG95: FuelStatusSchema.optional(),
    benzineG91: FuelStatusSchema.optional(),
    benzineE20: FuelStatusSchema.optional(),
    benzineE85: FuelStatusSchema.optional(),
    D: FuelStatusSchema.optional(),
    B20: FuelStatusSchema.optional(),
    G95: FuelStatusSchema.optional(),
    G91: FuelStatusSchema.optional(),
    E20: FuelStatusSchema.optional(),
    E85: FuelStatusSchema.optional(),
    fuelStatuses: z.record(z.string()).optional(),
  })
  .passthrough();

const UpstreamStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  district: z.string().optional().nullable(),
  province: z.string(),
  brandId: z.string().optional().nullable(),
  lat: z.number(),
  lon: z.number(),
  latestReport: UpstreamLatestReportSchema.optional().nullable(),
});

/** Upstream field name → UI keys (must match page.tsx FUEL_TYPES / mapFuelStatus). */
const UPSTREAM_FUEL_KEY_MAP: ReadonlyArray<[string, string]> = [
  ["diesel", "ดีเซล"],
  ["D", "ดีเซล"],
  ["dieselB20", "B20"],
  ["B20", "B20"],
  ["benzineG95", "95"],
  ["G95", "95"],
  ["benzineG91", "91"],
  ["G91", "91"],
  ["benzineE20", "E20"],
  ["E20", "E20"],
  ["benzineE85", "E85"],
  ["E85", "E85"],
];

const UPSTREAM_KEY_TO_UI = new Map<string, string>(UPSTREAM_FUEL_KEY_MAP);

function statusToAvailability(status?: string | null): boolean | undefined {
  if (!status || status === "unknown") return undefined;
  if (status === "out") return false;
  if (
    status === "available" ||
    status === "limited" ||
    status === "pending_delivery"
  ) {
    return true;
  }
  return undefined;
}

const UpstreamResponseSchema = z.object({
  province: z.string(),
  stations: z.array(UpstreamStationSchema),
});

type UiStation = {
  id: string;
  name: string;
  district?: string;
  province: string;
  brandId: string;
  lat: number;
  lon: number;
  fuels: Array<{ fuel: string; available: boolean }>;
  latestReport: Record<string, boolean>;
};

function toLatestReportBooleans(
  latestReport?: z.infer<typeof UpstreamLatestReportSchema> | null
): Record<string, boolean> {
  if (!latestReport || typeof latestReport !== "object") return {};

  const result: Record<string, boolean> = {};
  const row = latestReport as Record<string, unknown>;

  const setFromStatus = (uiKey: string, status: string | undefined) => {
    const b = statusToAvailability(status);
    if (b !== undefined) result[uiKey] = b;
  };

  const nested = row.fuelStatuses;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [key, val] of Object.entries(nested)) {
      const ui = UPSTREAM_KEY_TO_UI.get(key);
      if (ui && typeof val === "string") setFromStatus(ui, val);
    }
  }

  for (const [upstreamKey, uiKey] of UPSTREAM_FUEL_KEY_MAP) {
    const raw = row[upstreamKey];
    if (typeof raw === "string") setFromStatus(uiKey, raw);
  }

  return result;
}

async function fetchUpstreamStations(): Promise<UiStation[] | null> {
  try {
    const upstream = await fetch(STATIONS_API_URL, {
      method: "GET",
      cache: "no-store",
    });
    if (!upstream.ok) return null;
    const raw = await upstream.json();
    const parsed = UpstreamResponseSchema.safeParse(raw);
    if (!parsed.success) return null;

    return parsed.data.stations.map((station) => {
      const report = toLatestReportBooleans(station.latestReport);
      return {
        id: station.id,
        name: station.name,
        district: normalizeDistrict(station.district),
        province: PROVINCE_NAME,
        brandId: station.brandId || "OTHER",
        lat: station.lat,
        lon: station.lon,
        latestReport: report,
        fuels: Object.entries(report).map(([fuel, available]) => ({
          fuel,
          available: Boolean(available),
        })),
      };
    });
  } catch {
    return null;
  }
}

function normalizeDistrict(district?: string | null): string {
  if (!district) return "-";
  return district
    .replace(/^(อ\.?|อำเภอ)\s*/i, "")
    .replace(/^(ต\.?|ตำบล)\s*/i, "")
    .trim();
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const prev = rateLimitStore.get(ip) || [];
  const valid = prev.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX) return false;
  valid.push(now);
  rateLimitStore.set(ip, valid);
  return true;
}

function mapStationFromDb(station: {
  id: string;
  name: string;
  district: string | null;
  province: string;
  brandId: string;
  lat: number;
  lon: number;
  latestReport: unknown;
}): UiStation {
  const report =
    station.latestReport && typeof station.latestReport === "object"
      ? (station.latestReport as Record<string, boolean>)
      : {};

  return {
    id: station.id,
    name: station.name,
    district: station.district || "-",
    province: station.province,
    brandId: station.brandId,
    lat: station.lat,
    lon: station.lon,
    latestReport: report,
    fuels: Object.entries(report).map(([fuel, available]) => ({
      fuel,
      available: Boolean(available),
    })),
  };
}

async function syncFromUpstream(): Promise<boolean> {
  try {
    const stations = await fetchUpstreamStations();
    if (!stations) return false;

    const now = new Date();
    const records = stations.map((station) => {
      return {
        id: station.id,
        name: station.name,
        brandId: station.brandId || "OTHER",
        district: normalizeDistrict(station.district),
        province: PROVINCE_NAME,
        lat: station.lat,
        lon: station.lon,
        latestReport: station.latestReport,
        syncedAt: now,
      };
    });

    await db.$transaction(
      records.map((record) =>
        db.station.upsert({
          where: { id: record.id },
          update: {
            name: record.name,
            brandId: record.brandId,
            district: record.district,
            province: record.province,
            lat: record.lat,
            lon: record.lon,
            latestReport: record.latestReport,
            syncedAt: record.syncedAt,
          },
          create: record,
        })
      )
    );

    return true;
  } catch (error) {
    console.error("syncFromUpstream failed:", error);
    return false;
  }
}

async function applyReportOverlay(stations: UiStation[]): Promise<UiStation[]> {
  const now = Date.now();
  const staleBefore = new Date(now - RECOVERY_WINDOW_MS);

  await db.stationFuelStatus.deleteMany({
    where: {
      isEmpty: true,
      lastUpdated: { lt: staleBefore },
    },
  });

  const stationIds = stations.map((s) => s.id);
  if (!stationIds.length) return stations;

  const activeStatuses = await db.stationFuelStatus.findMany({
    where: {
      stationId: { in: stationIds },
      isEmpty: true,
      lastUpdated: { gte: staleBefore },
    },
  });

  const statusMap = new Map<string, Set<string>>();
  for (const row of activeStatuses) {
    const existing = statusMap.get(row.stationId) || new Set<string>();
    existing.add(row.fuelType);
    statusMap.set(row.stationId, existing);
  }

  return stations.map((station) => {
    const emptyFuels = statusMap.get(station.id);
    if (!emptyFuels) return station;

    const merged = { ...station.latestReport };
    for (const fuel of emptyFuels) merged[fuel] = false;

    return {
      ...station,
      latestReport: merged,
      fuels: Object.entries(merged).map(([fuel, available]) => ({
        fuel,
        available: Boolean(available),
      })),
    };
  });
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    let allowReport = false;
    const latest = await db.station.findFirst({
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    });

    const shouldSync =
      !latest || Date.now() - latest.syncedAt.getTime() > SYNC_TTL_MS;

    if (shouldSync) {
      // DB-first: API is only used as best-effort background refresh.
      const synced = await syncFromUpstream();
      allowReport = !synced;
    }

    let stations = await db.station.findMany({
      orderBy: { name: "asc" },
    });

    if (!stations.length) {
      const synced = await syncFromUpstream();
      if (synced) {
        stations = await db.station.findMany({
          orderBy: { name: "asc" },
        });
      }
    }

    if (!stations.length) {
      return NextResponse.json(
        { error: "No station data available yet." },
        { status: 503 }
      );
    }

    const mapped = stations.map(mapStationFromDb);
    const merged = await applyReportOverlay(mapped);
    const hiddenIds = await loadHiddenStationIds();
    const visible = filterOutHiddenStations(merged, hiddenIds);

    return NextResponse.json(
      {
        province: PROVINCE_NAME,
        source: "database",
        allowReport,
        stations: visible,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/stations failed, using upstream fallback:", error);
    const fallbackStations = await fetchUpstreamStations();
    if (fallbackStations) {
      const hiddenIds = await loadHiddenStationIds();
      const visible = filterOutHiddenStations(fallbackStations, hiddenIds);
      return NextResponse.json(
        {
          province: PROVINCE_NAME,
          source: "upstream-fallback",
          allowReport: false,
          stations: visible,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    }
    return NextResponse.json(
      { error: "Failed to load station data." },
      { status: 500 }
    );
  }
}
