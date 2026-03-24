import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function assertHasHiddenDelegate(client: PrismaClient) {
  const h = (client as unknown as { hiddenStation?: { findMany?: unknown } })
    .hiddenStation;
  if (h == null || typeof h.findMany !== "function") {
    throw new Error(
      "Prisma client is missing HiddenStation. Run: bun prisma generate && restart dev server"
    );
  }
}

function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached) {
    try {
      assertHasHiddenDelegate(cached);
    } catch {
      void cached.$disconnect().catch(() => undefined);
      globalForPrisma.prisma = undefined;
    }
  }
  if (!globalForPrisma.prisma) {
    const client = createPrismaClient();
    assertHasHiddenDelegate(client);
    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

/**
 * Proxy so every property read runs getPrisma() — avoids a stale PrismaClient
 * reference captured at module load (common with Next.js dev / HMR).
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
