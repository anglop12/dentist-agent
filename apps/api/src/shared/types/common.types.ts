/**
 * Tipos compartidos.
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),
  err: <E>(error: E): Result<never, E> => ({ ok: false, error }),
};

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type UUID = string;
export type ISODate = string;
export type ISOTime = string;
export type Phone = string;
export type Email = string;
export type MoneyCents = number;

export type Gender = 'male' | 'female' | 'other';
