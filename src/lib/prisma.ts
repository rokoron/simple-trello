import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  // Lazy init: avoids Prisma construction during Next.js build-time module evaluation
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL ?? "file:./dev.db";
    const adapter = new PrismaBetterSqlite3(
      { url },
      // For compatibility with Prisma's historical SQLite DateTime storage
      { timestampFormat: "unixepoch-ms" },
    );
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

