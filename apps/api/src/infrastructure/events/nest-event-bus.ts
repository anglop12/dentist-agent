import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent, IDomainEventBus } from '../../domain/shared/domain-event';

@Injectable()
export class NestEventEmitterBus implements IDomainEventBus, OnModuleInit {
  private readonly logger = new Logger(NestEventEmitterBus.name);
  private listenersRegistered = false;

  constructor(private readonly emitter: EventEmitter2) {}

  onModuleInit(): void {
    this.listenersRegistered = true;
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this.listenersRegistered) {
      this.logger.warn(`EventEmitter not ready, dropping ${event.eventName}`);
      return;
    }
    try {
      await this.emitter.emitAsync(event.eventName, event);
    } catch (e) {
      this.logger.error(`Error publishing ${event.eventName}: ${(e as Error).message}`);
      throw e;
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      await this.publish(e);
    }
  }

  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: (event: T) => Promise<void> | void,
  ): void {
    this.emitter.on(eventName, handler);
  }
}

export const DOMAIN_EVENT_BUS_TOKEN = Symbol('DOMAIN_EVENT_BUS_TOKEN');
