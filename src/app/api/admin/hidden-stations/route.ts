import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  stationId: z.string().min(1),
  note: z.string().optional(),
});

const PutSchema = z.object({
  stationIds: z.array(z.string()),
});

function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized",
      hint: "Set STATION_BLOCKLIST_ADMIN_SECRET in .env / Vercel and send it as header x-admin-secret.",
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
 * GET /api/admin/hidden-stations
 * List hidden station IDs (for maintenance).
 */
function prismaErrorPayload(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const missingTable =
    code === "P2021" ||
    /hidden_stations|does not exist|relation.*not found/i.test(msg);
  return {
    error: "Failed to load blocklist.",
    code,
    hint: missingTable
      ? "ตาราง hidden_stations ยังไม่มีในฐานข้อมูล — รัน: bun run db:push (หรือ prisma migrate deploy) บน DB นี้"
      : undefined,
    detail: process.env.NODE_ENV === "development" ? msg : undefined,
  };
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return unauthorized();
  try {
    const rows = await db.hiddenStation.findMany({
      orderBy: { createdAt: "desc" },
      select: { stationId: true, note: true, createdAt: true },
    });
    return NextResponse.json({ count: rows.length, stations: rows });
  } catch (error) {
    console.error("GET /api/admin/hidden-stations", error);
    const payload = prismaErrorPayload(error);
    return NextResponse.json(payload, { status: missingTableStatus(error) ? 503 : 500 });
  }
}

function missingTableStatus(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  return (
    code === "P2021" ||
    /hidden_stations|does not exist|relation.*not found/i.test(msg)
  );
}

/**
 * POST /api/admin/hidden-stations
 * Body: { "stationId": "...", "note": "optional" }
 */
export async function POST(req: NextRequest) {
  if (!checkSecret(req)) return unauthorized();
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await db.hiddenStation.upsert({
      where: { stationId: parsed.data.stationId },
      update: { note: parsed.data.note ?? undefined },
      create: {
        stationId: parsed.data.stationId,
        note: parsed.data.note,
      },
    });
    return NextResponse.json({ ok: true, stationId: parsed.data.stationId });
  } catch {
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/hidden-stations?stationId=...
 */
export async function DELETE(req: NextRequest) {
  if (!checkSecret(req)) return unauthorized();
  const stationId = req.nextUrl.searchParams.get("stationId");
  if (!stationId) {
    return NextResponse.json({ error: "Missing stationId" }, { status: 400 });
  }
  try {
    await db.hiddenStation.deleteMany({ where: { stationId } });
    return NextResponse.json({ ok: true, stationId });
  } catch {
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}

/**
 * PUT /api/admin/hidden-stations
 * Body: { "stationIds": ["id1", "id2"] }
 * Replaces the DB blocklist with this set (notes are cleared for removed/re-added rows).
 */
export async function PUT(req: NextRequest) {
  if (!checkSecret(req)) return unauthorized();
  try {
    const body = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const unique = [...new Set(parsed.data.stationIds.filter((id) => id.length > 0))];
    await db.$transaction(async (tx) => {
      await tx.hiddenStation.deleteMany({});
      if (unique.length > 0) {
        await tx.hiddenStation.createMany({
          data: unique.map((stationId) => ({ stationId })),
        });
      }
    });
    return NextResponse.json({ ok: true, count: unique.length });
  } catch {
    return NextResponse.json({ error: "Failed to sync blocklist." }, { status: 500 });
  }
}
