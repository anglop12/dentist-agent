import { Injectable } from '@nestjs/common';
import { MedicalAppointment } from '../../../src/domain/scheduling/appointment.entity';
import {
  IAppointmentRepository,
  AppointmentFilter,
} from '../../../src/domain/scheduling/repositories';

@Injectable()
export class InMemoryAppointmentRepository implements IAppointmentRepository {
  private store = new Map<string, MedicalAppointment>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findMany(filter: AppointmentFilter, opts?: { limit?: number; offset?: number }) {
    let arr = [...this.store.values()];
    if (filter.patientId) arr = arr.filter((a) => a.patientId === filter.patientId);
    if (filter.doctorId) arr = arr.filter((a) => a.doctorId === filter.doctorId);
    if (filter.status) arr = arr.filter((a) => a.status.value === filter.status);
    if (opts?.offset) arr = arr.slice(opts.offset);
    if (opts?.limit) arr = arr.slice(0, opts.limit);
    return arr;
  }
  async findActiveSlot(doctorId: string, date: string, time: string) {
    for (const a of this.store.values()) {
      if (
        a.doctorId === doctorId &&
        a.date.value === date &&
        a.time.value === time &&
        !['cancelled', 'completed', 'no_show', 'expired'].includes(a.status.value)
      ) {
        return a;
      }
    }
    return null;
  }
  async countActiveByDoctorAndDate(doctorId: string, date: string) {
    let n = 0;
    for (const a of this.store.values()) {
      if (
        a.doctorId === doctorId &&
        a.date.value === date &&
        ['pending', 'confirmed', 'checked_in'].includes(a.status.value)
      ) n++;
    }
    return n;
  }
  async save(a: MedicalAppointment) {
    this.store.set(a.id, a);
  }
  async delete(id: string) {
    this.store.delete(id);
  }
  async findByConversationId(cid: string) {
    for (const a of this.store.values()) if (a.conversationId === cid) return a;
    return null;
  }
}
