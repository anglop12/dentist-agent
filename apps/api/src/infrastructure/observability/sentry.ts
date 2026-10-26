import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../../config/env';

/**
 * SentryReporter - envía errores a Sentry si SENTRY_DSN está configurado.
 * Para activarlo, instalar: pnpm add @sentry/node
 */
@Injectable()
export class SentryReporter {
  private readonly logger = new Logger(SentryReporter.name);
  private initialized = false;

  init(): void {
    const env = loadEnv();
    if (!env.SENTRY_DSN) {
      this.logger.debug('Sentry disabled (SENTRY_DSN not set)');
      return;
    }
    try {
      const Sentry = require('@sentry/node');
      Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
      this.initialized = true;
      this.logger.log('Sentry initialized');
    } catch (e) {
      this.logger.warn(`Sentry init failed: ${(e as Error).message}`);
    }
  }

  captureException(err: Error, context?: Record<string, unknown>): void {
    if (!this.initialized) return;
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(err, { extra: context });
    } catch {
      // ignore
    }
  }
}
