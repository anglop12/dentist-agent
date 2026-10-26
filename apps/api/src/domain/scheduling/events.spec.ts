import { describe, expect, it } from 'vitest';
import {
  AppointmentCreatedEvent,
  AppointmentCancelledEvent,
  AppointmentConfirmedEvent,
  AppointmentRescheduledEvent,
  AppointmentStatusChangedEvent,
} from './events';

describe('Domain events', () => {
  it('AppointmentCreatedEvent has correct name and payload', () => {
    const e = new AppointmentCreatedEvent('a-1', {
      patientId: 'p-1',
      doctorId: 'd-1',
      date: '2026-08-21',
      time: '10:00',
      source: 'agent',
    });
    expect(e.eventName).toBe('AppointmentCreated');
    expect(e.aggregateId).toBe('a-1');
    expect(e.payload.patientId).toBe('p-1');
    expect(e.occurredAt).toBeInstanceOf(Date);
  });

  it('AppointmentConfirmedEvent', () => {
    const e = new AppointmentConfirmedEvent('a-1', {
      patientId: 'p',
      doctorId: 'd',
      date: '2026-08-21',
      time: '10:00',
    });
    expect(e.eventName).toBe('AppointmentConfirmed');
  });

  it('AppointmentCancelledEvent with reason', () => {
    const e = new AppointmentCancelledEvent('a-1', {
      patientId: 'p',
      doctorId: 'd',
      date: '2026-08-21',
      time: '10:00',
      reason: 'no longer needed',
    });
    expect(e.payload.reason).toBe('no longer needed');
  });

  it('AppointmentRescheduledEvent', () => {
    const e = new AppointmentRescheduledEvent('a-1', {
      patientId: 'p',
      doctorId: 'd',
      oldDate: '2026-08-21',
      oldTime: '10:00',
      newDate: '2026-08-22',
      newTime: '11:00',
    });
    expect(e.eventName).toBe('AppointmentRescheduled');
    expect(e.payload.newDate).toBe('2026-08-22');
  });

  it('AppointmentStatusChangedEvent', () => {
    const e = new AppointmentStatusChangedEvent('a-1', {
      patientId: 'p',
      doctorId: 'd',
      from: 'pending',
      to: 'confirmed',
    });
    expect(e.payload.from).toBe('pending');
    expect(e.payload.to).toBe('confirmed');
  });
});
