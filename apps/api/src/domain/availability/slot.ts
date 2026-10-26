import { DateOnly, TimeOfDay } from '../shared/value-objects';

export class Slot {
  private constructor(
    public readonly doctorId: string,
    public readonly date: DateOnly,
    public readonly time: TimeOfDay,
    public readonly available: boolean,
  ) {}

  static create(props: { doctorId: string; date: string; time: string; available: boolean }): Slot {
    return new Slot(
      props.doctorId,
      DateOnly.create(props.date),
      TimeOfDay.create(props.time),
      props.available,
    );
  }

  toJSON(): { doctorId: string; date: string; time: string; available: boolean } {
    return {
      doctorId: this.doctorId,
      date: this.date.value,
      time: this.time.value,
      available: this.available,
    };
  }
}

export class DailyCapacity {
  private constructor(
    public readonly doctorId: string,
    public readonly date: DateOnly,
    public readonly limit: number | null,
    public readonly booked: number,
  ) {}

  get remaining(): number | null {
    return this.limit === null ? null : Math.max(0, this.limit - this.booked);
  }

  get hasCapacity(): boolean {
    return this.limit === null || this.booked < this.limit;
  }

  static create(props: {
    doctorId: string;
    date: string;
    limit: number | null;
    booked: number;
  }): DailyCapacity {
    return new DailyCapacity(
      props.doctorId,
      DateOnly.create(props.date),
      props.limit,
      props.booked,
    );
  }
}
