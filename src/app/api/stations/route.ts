import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const STATIONS_API_URL = 'https://www.thaipumpradar.com/api/provinces/ปราจีนบุรี/stations';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

type RateBucket = { count: number; resetAt: number };
const globalForRateLimit = globalThis as unknown as {
  __stationsRateLimit?: Map<string, RateBucket>;
};
const rateStore = globalForRateLimit.__stationsRateLimit ?? new Map<string, RateBucket>();
globalForRateLimit.__stationsRateLimit = rateStore;

const FuelStatusSchema = z.enum(['available', 'limited', 'out', 'pending_delivery', 'unknown']);

const StationSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  brandId: z.string().min(1).max(32),
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  province: z.string().min(1).max(100),
  district: z.string().max(100).nullable().optional(),
  latestReport: z
    .object({
      diesel: FuelStatusSchema.optional(),
      dieselB20: FuelStatusSchema.optional(),
      benzineG95: FuelStatusSchema.optional(),
      benzineG91: FuelStatusSchema.optional(),
      benzineE20: FuelStatusSchema.optional(),
      benzineE85: FuelStatusSchema.optional(),
    })
    .optional(),
});

const StationsResponseSchema = z.object({
  stations: z.array(StationSchema).max(3000),
});

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function applyRateLimit(ip: string): { limited: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = rateStore.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { limited: true, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  rateStore.set(ip, bucket);
  return { limited: false };
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = applyRateLimit(ip);
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please retry shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rate.retryAfterSec ?? 60),
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    const upstream = await fetch(STATIONS_API_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Failed to fetch remote stations API (${upstream.status})` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const raw = await upstream.json();
    const parsed = StationsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Upstream stations payload validation failed' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const sanitized = {
      stations: parsed.data.stations.map((s) => ({
        ...s,
        name: s.name.trim(),
        province: s.province.trim(),
        district: s.district?.trim() ?? null,
      })),
    };

    return NextResponse.json(sanitized, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        Vary: 'Origin',
      },
    });
  } catch (error) {
    console.error('Failed to proxy stations API:', error);
    return NextResponse.json(
      { error: 'Unable to fetch stations from remote API' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
