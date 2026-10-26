import { Global, Module } from '@nestjs/common';
import { MetricsCollector } from './metrics';
import { AuditLogger } from './audit-logger';
import { KpiCache } from '../caching/kpi-cache';

/**
 * ObservabilityModule - proveedores globales de observabilidad.
 * Instancia única de métricas, audit log y caché de KPIs.
 */
@Global()
@Module({
  providers: [MetricsCollector, AuditLogger, KpiCache],
  exports: [MetricsCollector, AuditLogger, KpiCache],
})
export class ObservabilityModule {}
