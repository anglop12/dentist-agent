import { Injectable, Logger, Inject } from '@nestjs/common';
import { DB_TOKEN } from '../database/database.tokens';
import { auditLog } from '../database/schema';
import { v7 as uuidv7 } from 'uuid';

/**
 * AuditLogger - registra acciones sensibles en tabla audit_log.
 * Usar desde use cases para acciones como crear/modificar citas,
 * cancelar, etc.
 */
@Injectable()
export class AuditLogger {
  private readonly logger = new Logger(AuditLogger.name);

  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async log(args: {
    actor: string;
    action: string;
    resource: string;
    resourceId?: string;
    payload?: unknown;
  }): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        id: uuidv7(),
        actor: args.actor,
        action: args.action,
        resource: args.resource,
        resourceId: args.resourceId ?? null,
        payload: (args.payload ?? {}) as any,
        at: new Date(),
      });
    } catch (e) {
      this.logger.error(`audit_log insert failed: ${(e as Error).message}`);
    }
  }
}
