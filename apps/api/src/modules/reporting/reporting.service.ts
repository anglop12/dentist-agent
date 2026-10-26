import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, gte, lte, eq, and, count } from 'drizzle-orm';
import { medicalAppointments } from '../../infrastructure/database/schema';
import { DB_TOKEN } from '../../infrastructure/database/database.tokens';
import { KpiCache } from '../../infrastructure/caching/kpi-cache';
import { Conversation, ConversationContext } from '../../domain/conversation/conversation.entity';

export interface KpiSummary {
  appointments_total: number;
  appointments_by_status: Record<string, number>;
  no_show_rate: number;       // % de no_show / total completadas
  conversion_rate: number;    // % de pending/confirmed que terminan en completed
  avg_daily_appointments: number;
  estimated_revenue_cents: number;
  conversations_active: number;
  conversations_resolved: number;
}

export interface DailyMetric {
  date: string;
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

/**
 * ReportingService - computa KPIs del consultorio.
 * Usa KpiCache con TTL para no recalcular en cada request.
 */
@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly conn: any,
    private readonly cache: KpiCache,
  ) {}
  private get db() {
    return this.conn.db;
  }

  async getSummary(): Promise<KpiSummary> {
    const cached = await this.cache.get<KpiSummary>('summary');
    if (cached) return cached;

    const all = await this.db.select().from(medicalAppointments);
    const byStatus: Record<string, number> = {};
    for (const a of all) {
      byStatus[a.statusCode] = (byStatus[a.statusCode] ?? 0) + 1;
    }

    const total = all.length;
    const completed = byStatus['completed'] ?? 0;
    const noShow = byStatus['no_show'] ?? 0;
    const cancelled = byStatus['cancelled'] ?? 0;
    const confirmed = byStatus['confirmed'] ?? 0;

    const noShowRate = completed + noShow > 0 ? (noShow / (completed + noShow)) * 100 : 0;
    const conversionRate = total > 0 ? (completed / total) * 100 : 0;

    // Promedio diario (Ãºltimos 30 dÃ­as)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = all.filter((a: any) => new Date(a.createdAt) >= thirtyDaysAgo);
    const avgDaily = recent.length / 30;

    // Ingresos estimados (basado en deposit_amount promedio)
    const revenueCents = all
      .filter((a: any) => a.depositAmount && ['confirmed', 'checked_in', 'completed'].includes(a.statusCode))
      .reduce((s: number, a: any) => s + (a.depositAmount ?? 0), 0);

    const summary: KpiSummary = {
      appointments_total: total,
      appointments_by_status: byStatus,
      no_show_rate: Math.round(noShowRate * 10) / 10,
      conversion_rate: Math.round(conversionRate * 10) / 10,
      avg_daily_appointments: Math.round(avgDaily * 10) / 10,
      estimated_revenue_cents: revenueCents,
      conversations_active: 0, // TODO: contar conversaciones < 24h
      conversations_resolved: 0,
    };

    await this.cache.set('summary', summary, 300);
    return summary;
  }

  async getDailyMetrics(from: Date, to: Date): Promise<DailyMetric[]> {
    const cacheKey = `daily:${from.toISOString()}:${to.toISOString()}`;
    const cached = await this.cache.get<DailyMetric[]>(cacheKey);
    if (cached) return cached;

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const all = await this.db
      .select()
      .from(medicalAppointments)
      .where(and(gte(medicalAppointments.date, fromStr), lte(medicalAppointments.date, toStr)));

    const byDate = new Map<string, DailyMetric>();
    for (const a of all) {
      const date = a.date;
      if (!byDate.has(date)) {
        byDate.set(date, { date, total: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 });
      }
      const m = byDate.get(date)!;
      m.total++;
      const status = a.statusCode as keyof Omit<DailyMetric, 'date' | 'total'>;
      if (status in m) (m as any)[status]++;
    }

    const result = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  /** Tokens consumidos (placeholder - en F5 completo se conecta a OTel). */
  async getTokenUsage(days = 7): Promise<Array<{ date: string; tokens: number }>> {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().slice(0, 10), tokens: 0 };
    });
  }
}
