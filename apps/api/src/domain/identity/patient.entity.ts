import { Age, Cedula, Email, FullName, PhoneNumber } from '../shared/value-objects';

export type Gender = 0 | 1; // 0=female, 1=male (kept numeric for compatibility)

/**
 * Patient entity - una sola entidad sin tipos ni categorÃ­as.
 * El sistema legado distinguÃ­a titular/beneficiario/externo.
 * AquÃ­ toda persona registrada es simplemente un paciente del consultorio.
 */
export class Patient {
  private constructor(
    public readonly id: string,
    public readonly name: FullName,
    public readonly age: Age,
    public readonly cedula: Cedula,
    public readonly email: Email,
    public readonly phone: PhoneNumber,
    public readonly waPhone: PhoneNumber,
    public readonly birthdate: Date,
    public readonly address: string,
    public readonly gender: Gender,
    public notes: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(props: {
    id: string;
    name: string;
    lastname: string;
    age: number;
    cedula: number;
    email: string;
    phone: string;
    waPhone?: string;
    birthdate: Date;
    address: string;
    gender: Gender;
    notes?: string | null;
  }): Patient {
    const now = new Date();
    const waPhone = PhoneNumber.create(props.waPhone ?? props.phone);
    return new Patient(
      props.id,
      FullName.create(props.name, props.lastname),
      Age.create(props.age),
      Cedula.create(props.cedula),
      Email.create(props.email),
      PhoneNumber.create(props.phone),
      waPhone,
      props.birthdate,
      props.address,
      props.gender,
      props.notes ?? null,
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    name: string;
    lastname: string;
    age: number;
    cedula: number;
    email: string;
    phone: string;
    waPhone: string;
    birthdate: Date;
    address: string;
    gender: Gender;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Patient {
    return new Patient(
      props.id,
      FullName.create(props.name, props.lastname),
      Age.create(props.age),
      Cedula.create(props.cedula),
      Email.create(props.email),
      PhoneNumber.create(props.phone),
      PhoneNumber.create(props.waPhone),
      props.birthdate,
      props.address,
      props.gender,
      props.notes,
      props.createdAt,
      props.updatedAt,
    );
  }

  updateNotes(notes: string | null): void {
    this.notes = notes;
    this.touch();
  }

  updateContact(email: string, phone: string): void {
    (this as any).email = Email.create(email);
    (this as any).phone = PhoneNumber.create(phone);
    this.touch();
  }

  /** Anonymized version for sending to LLM. NEVER sends PHI. */
  anonymized(): { firstName: string; cedula: string } {
    return {
      firstName: this.name.name,
      cedula: '***' + this.cedula.value.toString().slice(-4),
    };
  }

  private touch(): void {
    (this as any).updatedAt = new Date();
  }
}
