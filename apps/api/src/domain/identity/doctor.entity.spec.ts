import { describe, expect, it } from 'vitest';
import { Doctor, Specialty } from './doctor.entity';

describe('Doctor entity', () => {
  it('creates with daily limit', () => {
    const d = Doctor.create({
      id: 'd-1',
      name: 'Ana',
      lastname: 'García',
      cedula: 123,
      email: 'a@b.com',
      phone: '+584141234567',
      specialtyId: 's-1',
      dailyLimit: 12,
    });
    expect(d.dailyLimit).toBe(12);
    expect(d.active).toBe(true);
  });

  it('rejects negative daily limit', () => {
    const d = Doctor.create({
      id: 'd-1',
      name: 'Ana',
      lastname: 'García',
      cedula: 123,
      email: 'a@b.com',
      phone: '+584141234567',
      specialtyId: 's-1',
    });
    expect(() => d.setDailyLimit(-5)).toThrow();
  });

  it('deactivates doctor', () => {
    const d = Doctor.create({
      id: 'd-1',
      name: 'Ana',
      lastname: 'García',
      cedula: 123,
      email: 'a@b.com',
      phone: '+584141234567',
      specialtyId: 's-1',
    });
    d.deactivate();
    expect(d.active).toBe(false);
  });
});

describe('Specialty entity', () => {
  it('creates with required name', () => {
    expect(() => Specialty.create({ id: 's', name: '' })).toThrow();
    const s = Specialty.create({ id: 's', name: 'Ortodoncia' });
    expect(s.name).toBe('Ortodoncia');
    expect(s.active).toBe(true);
  });
});
