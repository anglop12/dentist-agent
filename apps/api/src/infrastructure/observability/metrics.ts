import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const PROMETHEUS_REGISTRY = Symbol('PROMETHEUS_REGISTRY');

/**
 * MetricsCollector - expone métricas Prometheus para el agente.
 *
 * Métricas implementadas (según §12 del agente.md):
 *   - agent_messages_total{channel,state}
 *   - agent_tool_calls_total{tool,outcome}
 *   - agent_tokens_total{model,direction}
 *   - agent_latency_seconds{stage}
 *   - appointments_created_total{source}
 *   - appointments_no_show_total
 */
@Injectable()
export class MetricsCollector {
  readonly registry: Registry;

  readonly messages: Counter<'channel' | 'state'>;
  readonly toolCalls: Counter<'tool' | 'outcome'>;
  readonly tokens: Counter<'model' | 'direction'>;
  readonly latency: Histogram<'stage'>;
  readonly appointmentsCreated: Counter<'source'>;
  readonly appointmentsNoShow: Counter<string>;
  readonly conversationsActive: Gauge<'channel'>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.messages = new Counter({
      name: 'agent_messages_total',
      help: 'Total messages processed by the agent',
      labelNames: ['channel', 'state'],
      registers: [this.registry],
    });

    this.toolCalls = new Counter({
      name: 'agent_tool_calls_total',
      help: 'Total tool invocations',
      labelNames: ['tool', 'outcome'],
      registers: [this.registry],
    });

    this.tokens = new Counter({
      name: 'agent_tokens_total',
      help: 'Total tokens consumed',
      labelNames: ['model', 'direction'],
      registers: [this.registry],
    });

    this.latency = new Histogram({
      name: 'agent_latency_seconds',
      help: 'Agent operation latency',
      labelNames: ['stage'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.appointmentsCreated = new Counter({
      name: 'appointments_created_total',
      help: 'Total appointments created',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.appointmentsNoShow = new Counter({
      name: 'appointments_no_show_total',
      help: 'Total no-show appointments',
      registers: [this.registry],
    });

    this.conversationsActive = new Gauge({
      name: 'agent_conversations_active',
      help: 'Currently active conversations',
      labelNames: ['channel'],
      registers: [this.registry],
    });
  }

  /** Helper: mide latencia de una operación async y la registra. */
  async time<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    const end = this.latency.startTimer({ stage });
    try {
      return await fn();
    } finally {
      end();
    }
  }

  /** Serializa todas las métricas en formato Prometheus. */
  async serialize(): Promise<string> {
    return this.registry.metrics();
  }
}
