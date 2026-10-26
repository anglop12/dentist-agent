/**
 * Configuración de horario de atención.
 * En el futuro podría modelarse como tabla DoctorSchedule por día de semana.
 */

export const BUSINESS_HOURS_START = 8 * 60;   // 08:00
export const BUSINESS_HOURS_END = 18 * 60;    // 18:00
export const SLOT_DURATION_MINUTES = 30;

/** 0=Domingo, 1=Lunes, … 6=Sábado. Lunes a Sábado = [1..6]. */
export const BUSINESS_DAYS: number[] = [1, 2, 3, 4, 5, 6];
