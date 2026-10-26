import { describe, expect, it } from 'vitest';
import { Patient } from './patient.entity';

describe('Patient entity', () => {
  const baseProps = {
    id: 'p-001',
    name: 'Juan',
    lastname: 'Pérez',
    age: 35,
    cedula: 12345678,
    email: 'juan@example.com',
    phone: '+584141234567',
    birthdate: new Date('1989-01-01'),
    address: 'Calle 1',
    gender: 1 as const,
  };

  it('creates a valid patient', () => {
    const p = Patient.create(baseProps);
    expect(p.name.full).toBe('Juan Pérez');
    expect(p.email.value).toBe('juan@example.com');
    expect(p.waPhone.value).toBe('+584141234567');
  });

  it('rejects invalid email', () => {
    expect(() => Patient.create({ ...baseProps, email: 'invalid' })).toThrow();
  });

  it('rejects invalid phone', () => {
    expect(() => Patient.create({ ...baseProps, phone: 'abc' })).toThrow();
  });

  it('updates notes', () => {
    const p = Patient.create(baseProps);
    p.updateNotes('nueva nota');
    expect(p.notes).toBe('nueva nota');
  });

  it('anonymizes for LLM (no PHI)', () => {
    const p = Patient.create(baseProps);
    const a = p.anonymized();
    expect(a.firstName).toBe('Juan');
    expect(a.cedula).toMatch(/\*\*\*/);
    expect(a.cedula).not.toContain('12345678');
  });
});
