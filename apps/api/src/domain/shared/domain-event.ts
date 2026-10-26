/**
 * Interfaz del bus de eventos de dominio.
 * Implementaciones concretas en infrastructure.
 */
export abstract class DomainEvent {
  abstract readonly eventName: string;
  abstract readonly occurredAt: Date;
  readonly aggregateId: string;

  constructor(aggregateId: string) {
    this.aggregateId = aggregateId;
  }
}

export interface IDomainEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: (event: T) => Promise<void> | void,
  ): void;
}

export const DOMAIN_EVENT_BUS = Symbol('DOMAIN_EVENT_BUS');

export function domainEvent<T extends DomainEvent>(
  ctor: new (aggregateId: string, payload: any) => T,
  aggregateId: string,
  payload: ConstructorParameters<typeof ctor>[1],
): T {
  return new ctor(aggregateId, payload);
}
