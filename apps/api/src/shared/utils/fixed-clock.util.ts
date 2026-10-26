import { IClock, SystemClock } from './clock.util';

export class FixedClock implements IClock {
  private current: Date;

  constructor(initial: Date | string) {
    this.current = initial instanceof Date ? new Date(initial) : new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }
  today(): string {
    return this.now().toISOString().slice(0, 10);
  }
  nowMs(): number {
    return this.current.getTime();
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

  set(date: Date | string): void {
    this.current = date instanceof Date ? new Date(date) : new Date(date);
  }
}

export const Clock = {
  system: (): IClock => new SystemClock(),
  fixed: (date: Date | string): FixedClock => new FixedClock(date),
};
