import { DomainEvent } from '../../domain/shared/domain-event';
import { AppointmentStatus } from './appointment-status';

export class AppointmentCreatedEvent extends DomainEvent {
  readonly eventName = 'AppointmentCreated';
  readonly occurredAt: Date;
  constructor(
    aggregateId: string,
    public readonly payload: {
      patientId: string;
      doctorId: string;
      date: string;
      time: string;
      source: string;
    },
  ) {
    super(aggregateId);
    this.occurredAt = new Date();
  }
}

export class AppointmentConfirmedEvent extends DomainEvent {
  readonly eventName = 'AppointmentConfirmed';
  readonly occurredAt: Date;
  constructor(
    aggregateId: string,
    public readonly payload: { patientId: string; doctorId: string; date: string; time: string },
  ) {
    super(aggregateId);
    this.occurredAt = new Date();
  }
}

export class AppointmentCancelledEvent extends DomainEvent {
  readonly eventName = 'AppointmentCancelled';
  readonly occurredAt: Date;
  constructor(
    aggregateId: string,
    public readonly payload: {
      patientId: string;
      doctorId: string;
      date: string;
      time: string;
      reason?: string;
    },
  ) {
    super(aggregateId);
    this.occurredAt = new Date();
  }
}

export class AppointmentRescheduledEvent extends DomainEvent {
  readonly eventName = 'AppointmentRescheduled';
  readonly occurredAt: Date;
  constructor(
    aggregateId: string,
    public readonly payload: {
      patientId: string;
      doctorId: string;
      oldDate: string;
      oldTime: string;
      newDate: string;
      newTime: string;
    },
  ) {
    super(aggregateId);
    this.occurredAt = new Date();
  }
}

export class AppointmentStatusChangedEvent extends DomainEvent {
  readonly eventName = 'AppointmentStatusChanged';
  readonly occurredAt: Date;
  constructor(
    aggregateId: string,
    public readonly payload: {
      patientId: string;
      doctorId: string;
      from: AppointmentStatus;
      to: AppointmentStatus;
    },
  ) {
    super(aggregateId);
    this.occurredAt = new Date();
  }
}
