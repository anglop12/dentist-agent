/**
 * Value Objects compartidos del dominio.
 * Sin decorators, sin imports de NestJS. 100% puro.
 */

import { ValidationError } from '../../shared/errors/domain.errors';

export class PhoneNumber {
  private constructor(public readonly value: string) {}

  /** E.164 format: +[country code][number], 8-15 digits. */
  static create(value: string): PhoneNumber {
    if (!value) throw new ValidationError('Phone cannot be empty');
    const clean = value.replace(/[\s\-\(\)]/g, '');
    const e164Regex = /^\+?[1-9]\d{7,14}$/;
    if (!e164Regex.test(clean)) {
      throw new ValidationError(`Invalid phone number: ${value}`);
    }
    return new PhoneNumber(clean.startsWith('+') ? clean : `+${clean}`);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    if (!value) throw new ValidationError('Email cannot be empty');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`Invalid email: ${value}`);
    }
    return new Email(value.toLowerCase());
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class Cedula {
  private constructor(public readonly value: number) {}

  static create(value: number | string): Cedula {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!Number.isFinite(num) || num <= 0) {
      throw new ValidationError(`Invalid cedula: ${value}`);
    }
    return new Cedula(num);
  }

  equals(other: Cedula): boolean {
    return this.value === other.value;
  }
}

export class Age {
  private constructor(public readonly value: number) {}

  static create(value: number): Age {
    if (!Number.isFinite(value) || value < 0 || value > 150) {
      throw new ValidationError(`Invalid age: ${value}`);
    }
    return new Age(Math.floor(value));
  }

  static fromBirthdate(birthdate: Date, now: Date = new Date()): Age {
    let age = now.getFullYear() - birthdate.getFullYear();
    const monthDiff = now.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthdate.getDate())) {
      age--;
    }
    return Age.create(age);
  }
}

export class DateOnly {
  /** YYYY-MM-DD string */
  private constructor(public readonly value: string) {}

  static create(value: string | Date): DateOnly {
    if (value instanceof Date) {
      const iso = value.toISOString().slice(0, 10);
      return new DateOnly(iso);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ValidationError(`Invalid date (expected YYYY-MM-DD): ${value}`);
    }
    return new DateOnly(value);
  }

  static today(now: Date = new Date()): DateOnly {
    return DateOnly.create(now);
  }

  toDate(): Date {
    return new Date(`${this.value}T00:00:00.000Z`);
  }

  equals(other: DateOnly): boolean {
    return this.value === other.value;
  }

  isBefore(other: DateOnly): boolean {
    return this.value < other.value;
  }

  isAfter(other: DateOnly): boolean {
    return this.value > other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class TimeOfDay {
  /** HH:MM (24h) */
  private constructor(public readonly value: string) {}

  static create(value: string): TimeOfDay {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new ValidationError(`Invalid time (expected HH:MM): ${value}`);
    }
    return new TimeOfDay(value);
  }

  toMinutes(): number {
    const [h, m] = this.value.split(':').map(Number);
    return h * 60 + m;
  }

  equals(other: TimeOfDay): boolean {
    return this.value === other.value;
  }

  isBefore(other: TimeOfDay): boolean {
    return this.toMinutes() < other.toMinutes();
  }

  toString(): string {
    return this.value;
  }
}

export class FullName {
  private constructor(
    public readonly name: string,
    public readonly lastname: string,
  ) {}

  static create(name: string, lastname: string): FullName {
    if (!name?.trim()) throw new ValidationError('Name cannot be empty');
    if (!lastname?.trim()) throw new ValidationError('Lastname cannot be empty');
    return new FullName(name.trim(), lastname.trim());
  }

  get full(): string {
    return `${this.name} ${this.lastname}`;
  }

  equals(other: FullName): boolean {
    return this.name === other.name && this.lastname === other.lastname;
  }
}
