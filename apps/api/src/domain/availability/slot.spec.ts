import { describe, expect, it, beforeEach } from 'vitest';
import { Slot, DailyCapacity } from './slot';

describe('Slot', () => {
  it('creates available slot', () => {
    const s = Slot.create({ doctorId: 'd1', date: '2026-08-21', time: '10:00', available: true });
    expect(s.available).toBe(true);
    expect(s.toJSON()).toEqual({ doctorId: 'd1', date: '2026-08-21', time: '10:00', available: true });
  });

  it('rejects invalid date', () => {
    expect(() => Slot.create({ doctorId: 'd1', date: 'invalid', time: '10:00', available: true })).toThrow();
  });

  it('rejects invalid time', () => {
    expect(() => Slot.create({ doctorId: 'd1', date: '2026-08-21', time: '25:00', available: true })).toThrow();
  });
});

describe('DailyCapacity', () => {
  it('computes remaining with limit', () => {
    const dc = DailyCapacity.create({ doctorId: 'd1', date: '2026-08-21', limit: 10, booked: 3 });
    expect(dc.remaining).toBe(7);
    expect(dc.hasCapacity).toBe(true);
  });

  it('returns null remaining without limit', () => {
    const dc = DailyCapacity.create({ doctorId: 'd1', date: '2026-08-21', limit: null, booked: 0 });
    expect(dc.remaining).toBeNull();
    expect(dc.hasCapacity).toBe(true);
  });

  it('has no capacity when full', () => {
    const dc = DailyCapacity.create({ doctorId: 'd1', date: '2026-08-21', limit: 5, booked: 5 });
    expect(dc.remaining).toBe(0);
    expect(dc.hasCapacity).toBe(false);
  });
});
