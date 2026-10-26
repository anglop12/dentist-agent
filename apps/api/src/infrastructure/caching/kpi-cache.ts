import { Injectable, Logger, Inject } from '@nestjs/common';
import { DB_TOKEN } from '../database/database.tokens';
import { kpiCache } from '../database/schema';
import { eq, lt } from 'drizzle-orm';

/**
 * KpiCache - caché de KPIs computados.
 *
 * - Guarda valores JSON en tabla `kpi_cache` con TTL.
 * - Se invalida automáticamente vía eventos de dominio.
 * - Si la key no existe o expiró → null (el caller recomputa).
 */
@Injectable()
export class KpiCache {
  private readonly logger = new Logger(KpiCache.name);

  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}

  private get db() {
    return this.conn.db;
  }

  async get<T>(key: string): Promise<T | null> {
    const rows = await this.db.select().from(kpiCache).where(eq(kpiCache.key, key)).limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.db.delete(kpiCache).where(eq(kpiCache.key, key));
      return null;
    }
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    const now = new Date();
    const expires = new Date(now.getTime() + ttlSeconds * 1000);
    await this.db
      .insert(kpiCache)
      .values({
        key,
        value: JSON.stringify(value),
        computedAt: now,
        expiresAt: expires,
      })
      .onConflictDoUpdate({
        target: kpiCache.key,
        set: { value: JSON.stringify(value), computedAt: now, expiresAt: expires },
      });
  }

  async invalidate(key: string): Promise<void> {
    await this.db.delete(kpiCache).where(eq(kpiCache.key, key));
  }

  async invalidateAll(): Promise<void> {
    await this.db.delete(kpiCache);
  }

  async purgeExpired(): Promise<void> {
    await this.db.delete(kpiCache).where(lt(kpiCache.expiresAt, new Date()));
  }
}
