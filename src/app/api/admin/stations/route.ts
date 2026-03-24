import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized",
      hint: "Set STATION_BLOCKLIST_ADMIN_SECRET and send x-admin-secret header.",
    },
    { status: 401 }
  );
}

function checkSecret(req: NextRequest): boolean {
  const secret = process.env.STATION_BLOCKLIST_ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-admin-secret");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return header === secret || bearer === secret;
}

/**
 * GET /api/admin/stations
 * All stations from DB (not filtered by blocklist) — for admin UI only.
 */
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return unauthorized();
  try {
    const rows = await db.station.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        district: true,
        brandId: true,
        lat: true,
        lon: true,
      },
    });
    return NextResponse.json({
      stations: rows.map((s) => ({
        id: s.id,
        name: s.name,
        district: s.district || "-",
        brandId: s.brandId,
        lat: s.lat,
        lon: s.lon,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/stations", error);
    const msg = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    const missing =
      code === "P2021" ||
      /does not exist|relation.*not found/i.test(msg);
    return NextResponse.json(
      {
        error: "Failed to load stations.",
        code,
        hint: missing
          ? "รัน bun run db:push กับ DATABASE_URL นี้ หรือตรวจสอบการเชื่อมต่อ Neon"
          : undefined,
        detail: process.env.NODE_ENV === "development" ? msg : undefined,
      },
      { status: missing ? 503 : 500 }
    );
  }
}
