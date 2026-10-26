import { Injectable, Logger, Inject } from '@nestjs/common';
import { DB_TOKEN } from '../database/database.tokens';
import { specialties, statusMedicalAppointments } from '../database/schema';
import { OnEvent } from '@nestjs/event-emitter';
import { Specialty } from '../../domain/identity/doctor.entity';
import { APPOINTMENT_STATUSES, AppointmentStatus } from '../../domain/scheduling/appointment-status';

/**
 * CatalogCache - cachÃ© en memoria de catÃ¡logos (specialties, statuses).
 * Se invalida automÃ¡ticamente cuando eventos de dominio relevantes ocurren.
 * Reduce queries a BD en cada request.
 */
@Injectable()
export class CatalogCache {
  private readonly logger = new Logger(CatalogCache.name);
  private specialtiesCache: Specialty[] = [];
  private statusesCache: AppointmentStatus[] | null = null;
  private lastLoadedAt = 0;
  private readonly ttlMs = 60_000; // 1 min

  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async getSpecialties(): Promise<Specialty[]> {
    if (this.specialtiesCache.length > 0 && Date.now() - this.lastLoadedAt < this.ttlMs) {
      return this.specialtiesCache;
    }
    const rows = await this.db.select().from(specialties);
    this.specialtiesCache = rows.map((r: any) =>
      Specialty.reconstitute({
        id: r.id,
        name: r.name,
        description: r.description,
        active: r.active,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
    this.lastLoadedAt = Date.now();
    return this.specialtiesCache;
  }

  getAppointmentStatuses(): AppointmentStatus[] {
    if (!this.statusesCache) {
      this.statusesCache = [...APPOINTMENT_STATUSES];
    }
    return this.statusesCache;
  }

  @OnEvent('*', { /* wildcard match */ })
  invalidateOnEvent(event: any): void {
    // Cualquier evento relacionado con catÃ¡logos invalida la cachÃ©.
    if (event?.eventName?.includes('Specialty') || event?.eventName?.includes('Status')) {
      this.specialtiesCache = [];
      this.statusesCache = null;
      this.logger.debug('Catalog cache invalidated by event');
    }
  }
}
