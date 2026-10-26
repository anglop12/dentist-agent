import { describe, expect, it } from 'vitest';
import { MedicalAppointment } from './appointment.entity';

describe('MedicalAppointment entity', () => {
  const base = {
    id: 'a-1',
    patientId: 'p-1',
    doctorId: 'd-1',
    date: '2026-08-21',
    time: '10:00',
  };

  it('creates in pending state', () => {
    const a = MedicalAppointment.create(base);
    expect(a.status.value).toBe('pending');
    expect(a.source).toBe('agent');
  });

  it('reschedules a non-terminal appointment', () => {
    const a = MedicalAppointment.create(base);
    a.reschedule(
      { value: '2026-08-22' } as any,
      { value: '11:30' } as any,
    );
    expect(a.date.value).toBe('2026-08-22');
    expect(a.time.value).toBe('11:30');
  });

  it('throws when rescheduling terminal status', () => {
    const a = MedicalAppointment.create(base);
    a.changeStatus(
      AppointmentStatusVO_completed(),
    );
    expect(() => a.reschedule({ value: 'x' } as any, { value: 'x' } as any)).toThrow();
  });

  it('attaches payment intent', () => {
    const a = MedicalAppointment.create(base);
    a.attachPaymentIntent('pi_123', 5000);
    expect(a.paymentIntentId).toBe('pi_123');
    expect(a.depositAmount).toBe(5000);
  });
});

// Helper local para no crear import circular.
function AppointmentStatusVO_completed() {
  const { AppointmentStatusVO } = require('./appointment-status');
  return AppointmentStatusVO.completed();
}
