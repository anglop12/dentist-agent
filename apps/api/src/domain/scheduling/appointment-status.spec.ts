import { describe, expect, it } from 'vitest';
import { AppointmentStatusVO } from './appointment-status';

describe('AppointmentStatusVO (FSM)', () => {
  it('starts as pending', () => {
    expect(AppointmentStatusVO.pending().value).toBe('pending');
  });

  it('allows pending -> confirmed -> checked_in -> completed', () => {
    let s = AppointmentStatusVO.pending();
    s = s.transitionTo(AppointmentStatusVO.confirmed());
    s = s.transitionTo(AppointmentStatusVO.checkedIn());
    s = s.transitionTo(AppointmentStatusVO.completed());
    expect(s.value).toBe('completed');
  });

  it('rejects invalid transition', () => {
    const s = AppointmentStatusVO.pending();
    expect(() => s.transitionTo(AppointmentStatusVO.completed())).toThrow();
  });

  it('rejects transition from terminal', () => {
    const s = AppointmentStatusVO.completed();
    expect(s.isTerminal()).toBe(true);
    expect(() => s.transitionTo(AppointmentStatusVO.cancelled())).toThrow();
  });

  it('allows pending -> cancelled', () => {
    const s = AppointmentStatusVO.pending().transitionTo(AppointmentStatusVO.cancelled());
    expect(s.value).toBe('cancelled');
  });

  it('allows confirmed -> no_show', () => {
    const s = AppointmentStatusVO.confirmed().transitionTo(AppointmentStatusVO.noShow());
    expect(s.value).toBe('no_show');
  });
});
