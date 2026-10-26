/**
 * Máquina de estados de la cita (FSM).
 *
 *   PENDING ──► CONFIRMED ──► CHECKED_IN ──► COMPLETED
 *      │            │              │
 *      │            │              └─► NO_SHOW
 *      │            └─► CANCELLED
 *      └─► EXPIRED
 */

import { BusinessRuleError } from '../../shared/errors/domain.errors';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'expired';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'cancelled',
  'expired',
];

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'no_show'],
  completed: [],
  no_show: [],
  cancelled: [],
  expired: [],
};

export class AppointmentStatusVO {
  private constructor(public readonly value: AppointmentStatus) {}

  static create(value: string): AppointmentStatusVO {
    if (!APPOINTMENT_STATUSES.includes(value as AppointmentStatus)) {
      throw new BusinessRuleError(`Invalid appointment status: ${value}`);
    }
    return new AppointmentStatusVO(value as AppointmentStatus);
  }

  static pending(): AppointmentStatusVO {
    return new AppointmentStatusVO('pending');
  }
  static confirmed(): AppointmentStatusVO {
    return new AppointmentStatusVO('confirmed');
  }
  static checkedIn(): AppointmentStatusVO {
    return new AppointmentStatusVO('checked_in');
  }
  static completed(): AppointmentStatusVO {
    return new AppointmentStatusVO('completed');
  }
  static noShow(): AppointmentStatusVO {
    return new AppointmentStatusVO('no_show');
  }
  static cancelled(): AppointmentStatusVO {
    return new AppointmentStatusVO('cancelled');
  }
  static expired(): AppointmentStatusVO {
    return new AppointmentStatusVO('expired');
  }

  canTransitionTo(next: AppointmentStatusVO): boolean {
    return TRANSITIONS[this.value].includes(next.value);
  }

  transitionTo(next: AppointmentStatusVO): AppointmentStatusVO {
    if (!this.canTransitionTo(next)) {
      throw new BusinessRuleError(
        `Cannot transition appointment from ${this.value} to ${next.value}`,
      );
    }
    return next;
  }

  isTerminal(): boolean {
    return TRANSITIONS[this.value].length === 0;
  }

  equals(other: AppointmentStatusVO): boolean {
    return this.value === other.value;
  }
}
