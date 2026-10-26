import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Slot, DailyCapacity } from '../../../domain/availability/slot';
import {
  APPOINTMENT_REPOSITORY,
  IAppointmentRepository,
} from '../../../domain/scheduling/repositories';
import {
  DOCTOR_REPOSITORY,
  IDoctorRepository,
} from '../../../domain/identity/repositories';
import {
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  SLOT_DURATION_MINUTES,
  BUSINESS_DAYS,
} from '../business-hours.config';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain.errors';
import { DateOnly, TimeOfDay } from '../../../domain/shared/value-objects';

export const CheckAvailabilitySchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CheckAvailabilityInput = z.infer<typeof CheckAvailabilitySchema>;

export interface AvailabilityResult {
  doctorId: string;
  date: string;
  slots: Array<{ time: string; available: boolean }>;
  capacity: {
    limit: number | null;
    booked: number;
    remaining: number | null;
  };
}

/**
 * Use case principal: devuelve los slots disponibles de un doctor en una fecha,
 * respetando horario de atención y cupo diario.
 */
@Injectable()
export class CheckAvailabilityUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
  ) {}

  async execute(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
    const parsed = CheckAvailabilitySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const { doctorId, date } = parsed.data;

    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor', doctorId);
    if (!doctor.active) throw new ValidationError('Doctor is not active');

    // Validar día hábil
    const d = DateOnly.create(date).toDate();
    const weekday = d.getDay();
    if (!BUSINESS_DAYS.includes(weekday)) {
      return {
        doctorId,
        date,
        slots: [],
        capacity: { limit: doctor.dailyLimit, booked: 0, remaining: doctor.dailyLimit },
      };
    }

    // Generar todos los slots teóricos
    const slots: Slot[] = [];
    for (
      let mins = BUSINESS_HOURS_START;
      mins < BUSINESS_HOURS_END;
      mins += SLOT_DURATION_MINUTES
    ) {
      const hh = Math.floor(mins / 60).toString().padStart(2, '0');
      const mm = (mins % 60).toString().padStart(2, '0');
      slots.push(Slot.create({ doctorId, date, time: `${hh}:${mm}`, available: true }));
    }

    // Marcar ocupados: cualquier cita no terminal ese día/hora.
    const taken = await this.apptRepo.findMany(
      { doctorId, from: DateOnly.create(date), to: DateOnly.create(date) },
      { limit: 500, offset: 0 },
    );
    const takenSet = new Set(
      taken
        .filter((a) => !['cancelled', 'no_show', 'expired', 'completed'].includes(a.status.value))
        .map((a) => a.time.value),
    );

    const slotsWithAvailability = slots.map((s) =>
      Slot.create({ ...s.toJSON(), available: !takenSet.has(s.time.value) }),
    );

    // Si ya no quedan cupos, marcar todos como ocupados.
    const booked = taken.filter((a) =>
      ['pending', 'confirmed', 'checked_in'].includes(a.status.value),
    ).length;
    const remaining =
      doctor.dailyLimit === null ? null : Math.max(0, doctor.dailyLimit - booked);
    if (remaining === 0) {
      for (let i = 0; i < slotsWithAvailability.length; i++) {
        slotsWithAvailability[i] = Slot.create({
          ...slotsWithAvailability[i].toJSON(),
          available: false,
        });
      }
    }

    return {
      doctorId,
      date,
      slots: slotsWithAvailability.map((s) => s.toJSON()),
      capacity: { limit: doctor.dailyLimit, booked, remaining },
    };
  }
}

/** Use case helper: valida que un slot específico siga libre. */
@Injectable()
export class ValidateSlotUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
  ) {}

  async execute(doctorId: string, date: string, time: string): Promise<boolean> {
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor || !doctor.active) return false;

    const timeVO = TimeOfDay.create(time);
    if (
      timeVO.toMinutes() < BUSINESS_HOURS_START ||
      timeVO.toMinutes() >= BUSINESS_HOURS_END
    ) {
      return false;
    }

    const slot = await this.apptRepo.findActiveSlot(doctorId, date, time);
    if (slot) return false;

    if (doctor.dailyLimit !== null) {
      const booked = await this.apptRepo.countActiveByDoctorAndDate(doctorId, date);
      if (booked >= doctor.dailyLimit) return false;
    }

    return true;
  }
}
