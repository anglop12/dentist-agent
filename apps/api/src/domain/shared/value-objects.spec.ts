import { describe, expect, it } from 'vitest';
import { DateOnly, TimeOfDay, Email, PhoneNumber, Cedula, Age } from './value-objects';

describe('Value Objects', () => {
  it('DateOnly rejects invalid format', () => {
    expect(() => DateOnly.create('21/08/2026')).toThrow();
    expect(DateOnly.create('2026-08-21').value).toBe('2026-08-21');
  });

  it('DateOnly compares correctly', () => {
    const a = DateOnly.create('2026-08-21');
    const b = DateOnly.create('2026-08-22');
    expect(a.isBefore(b)).toBe(true);
    expect(b.isAfter(a)).toBe(true);
  });

  it('TimeOfDay rejects invalid', () => {
    expect(() => TimeOfDay.create('25:00')).toThrow();
    expect(TimeOfDay.create('09:30').toMinutes()).toBe(9 * 60 + 30);
  });

  it('Email lowercases', () => {
    expect(Email.create('USER@EXAMPLE.COM').value).toBe('user@example.com');
  });

  it('PhoneNumber normalizes to E.164', () => {
    expect(PhoneNumber.create('584141234567').value).toBe('+584141234567');
  });

  it('Cedula rejects zero', () => {
    expect(() => Cedula.create(0)).toThrow();
  });

  it('Age from birthdate', () => {
    const a = Age.fromBirthdate(new Date('2000-01-01'), new Date('2026-01-01'));
    expect(a.value).toBe(26);
  });
});
