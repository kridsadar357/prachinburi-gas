import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const MAX_REPORT_DISTANCE_METERS = 200;
const REPORT_WINDOW_MS = 60 * 60 * 1000;
const REPORT_THRESHOLD = 3;
const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

const ReportSchema = z.object({
  stationId: z.string().min(1),
  fuelType: z.string().min(1),
  userLat: z.number().min(-90).max(90),
  userLng: z.number().min(-180).max(180),
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { stationId, fuelType, userLat, userLng } = parsed.data;
    const clientIp = getClientIp(req);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - REPORT_WINDOW_MS);
    const recoveryCutoff = new Date(now.getTime() - RECOVERY_WINDOW_MS);

    await db.stationFuelStatus.deleteMany({
      where: {
        isEmpty: true,
        lastUpdated: { lt: recoveryCutoff },
      },
    });

    const station = await db.station.findUnique({
      where: { id: stationId },
      select: { id: true, lat: true, lon: true, latestReport: true },
    });

    if (!station) {
      return NextResponse.json({ error: "Station not found." }, { status: 404 });
    }

    const distance = haversineMeters(userLat, userLng, station.lat, station.lon);
    if (distance > MAX_REPORT_DISTANCE_METERS) {
      return NextResponse.json(
        {
          error:
            "You must be within 200 meters of this station to submit a report.",
        },
        { status: 403 }
      );
    }

    const latestReport =
      station.latestReport && typeof station.latestReport === "object"
        ? (station.latestReport as Record<string, boolean>)
        : {};
    const knownFuelTypes = new Set(Object.keys(latestReport));
    if (knownFuelTypes.size > 0 && !knownFuelTypes.has(fuelType)) {
      return NextResponse.json(
        { error: "Fuel type is not valid for this station." },
        { status: 400 }
      );
    }

    const existing = await db.fuelReport.findFirst({
      where: {
        stationId,
        fuelType,
        userIp: clientIp,
        reportedAt: { gte: oneHourAgo },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "You already reported this fuel recently. Please try later.",
        },
        { status: 429 }
      );
    }

    await db.fuelReport.create({
      data: {
        stationId,
        fuelType,
        userIp: clientIp,
        userLat,
        userLng,
      },
    });

    const reportCount = await db.fuelReport.count({
      where: {
        stationId,
        fuelType,
        reportedAt: { gte: oneHourAgo },
      },
    });

    let markedOutOfStock = false;
    if (reportCount >= REPORT_THRESHOLD) {
      await db.stationFuelStatus.upsert({
        where: {
          stationId_fuelType: {
            stationId,
            fuelType,
          },
        },
        update: {
          isEmpty: true,
          lastUpdated: now,
        },
        create: {
          stationId,
          fuelType,
          isEmpty: true,
          lastUpdated: now,
        },
      });
      markedOutOfStock = true;
    }

    return NextResponse.json({
      success: true,
      message: markedOutOfStock
        ? "Report received. Fuel is now marked as out of stock."
        : `Report received (${reportCount}/${REPORT_THRESHOLD}).`,
      reportCount,
      threshold: REPORT_THRESHOLD,
      markedOutOfStock,
      maxDistanceMeters: MAX_REPORT_DISTANCE_METERS,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit report." },
      { status: 500 }
    );
  }
}
