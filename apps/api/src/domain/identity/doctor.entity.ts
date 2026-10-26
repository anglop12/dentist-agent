import { Cedula, Email, FullName, PhoneNumber } from '../shared/value-objects';

export class Specialty {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(props: {
    id: string;
    name: string;
    description?: string | null;
  }): Specialty {
    const now = new Date();
    if (!props.name?.trim()) throw new Error('Specialty name required');
    return new Specialty(props.id, props.name.trim(), props.description ?? null, true, now, now);
  }

  static reconstitute(props: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Specialty {
    return new Specialty(
      props.id,
      props.name,
      props.description,
      props.active,
      props.createdAt,
      props.updatedAt,
    );
  }

  rename(name: string): void {
    (this as any).name = name;
    (this as any).updatedAt = new Date();
  }
}

export class Doctor {
  private constructor(
    public readonly id: string,
    public readonly name: FullName,
    public readonly cedula: Cedula,
    public readonly email: Email,
    public readonly phone: PhoneNumber,
    public readonly specialtyId: string,
    /** Cupo diario único (sin distinción de tipos). null = sin tope. */
    public readonly dailyLimit: number | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(props: {
    id: string;
    name: string;
    lastname: string;
    cedula: number;
    email: string;
    phone: string;
    specialtyId: string;
    dailyLimit?: number | null;
  }): Doctor {
    const now = new Date();
    return new Doctor(
      props.id,
      FullName.create(props.name, props.lastname),
      Cedula.create(props.cedula),
      Email.create(props.email),
      PhoneNumber.create(props.phone),
      props.specialtyId,
      props.dailyLimit ?? null,
      true,
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    name: string;
    lastname: string;
    cedula: number;
    email: string;
    phone: string;
    specialtyId: string;
    dailyLimit: number | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Doctor {
    return new Doctor(
      props.id,
      FullName.create(props.name, props.lastname),
      Cedula.create(props.cedula),
      Email.create(props.email),
      PhoneNumber.create(props.phone),
      props.specialtyId,
      props.dailyLimit,
      props.active,
      props.createdAt,
      props.updatedAt,
    );
  }

  setDailyLimit(limit: number | null): void {
    if (limit !== null && limit <= 0) throw new Error('Daily limit must be positive');
    (this as any).dailyLimit = limit;
    (this as any).updatedAt = new Date();
  }

  deactivate(): void {
    (this as any).active = false;
    (this as any).updatedAt = new Date();
  }

  anonymized(): { firstName: string; specialtyId: string } {
    return {
      firstName: this.name.name,
      specialtyId: this.specialtyId,
    };
  }
}
