/**
 * Puerto de reloj - permite inyectar un reloj mockeable en tests.
 */
export interface IClock {
  now(): Date;
  today(): string;
  nowMs(): number;
  addDays(date: Date, days: number): Date;
  addMinutes(date: Date, minutes: number): Date;
  isBefore(a: Date, b: Date): boolean;
  diffMinutes(a: Date, b: Date): number;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  today(): string {
    return new Date().toISOString().slice(0, 10);
  }
  nowMs(): number {
    return Date.now();
  }
  addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
  isBefore(a: Date, b: Date): boolean {
    return a.getTime() < b.getTime();
  }
  diffMinutes(a: Date, b: Date): number {
    return Math.floor((a.getTime() - b.getTime()) / 60_000);
  }
}

export const CLOCK = Symbol('CLOCK');
