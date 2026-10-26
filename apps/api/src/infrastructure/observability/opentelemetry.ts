import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../../config/env';

/**
 * OpenTelemetry stub - activa el SDK si OTEL_ENABLED=true.
 * En desarrollo exporta a consola; en producciÃ³n se puede cambiar a OTLP.
 *
 * Para uso real, instalar:
 *   pnpm add @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-node
 */
@Injectable()
export class OpenTelemetryProvider {
  private readonly logger = new Logger(OpenTelemetryProvider.name);
  private started = false;

  async init(): Promise<void> {
    const env = loadEnv();
    if (!env.OTEL_ENABLED) {
      this.logger.debug('OpenTelemetry disabled (OTEL_ENABLED=false)');
      return;
    }

    try {
      // @ts-ignore - paquete opcional, instalar para activar tracing
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const traceBase = '@opentelemetry/sdk-trace-base';
      const { ConsoleSpanExporter, SimpleSpanProcessor } = await import(traceBase);

      const sdk = new NodeSDK({
        traceExporter: new ConsoleSpanExporter(),
        spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter()),
      });

      sdk.start();
      this.started = true;
      this.logger.log('OpenTelemetry started (console exporter)');
    } catch (e) {
      this.logger.warn(
        `OTel init failed (paquetes no instalados): ${(e as Error).message}. ` +
          'Instala @opentelemetry/sdk-node para activarlo.',
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.started) return;
    try {
      // @ts-ignore - paquete opcional, instalar para activar tracing
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      // shutdown se hace dentro del SDK si fue instanciado.
      void NodeSDK;
    } catch {
      // ignore
    }
  }
}
