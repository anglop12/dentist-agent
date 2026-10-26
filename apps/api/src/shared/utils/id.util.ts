import { randomUUID } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

export const Id = {
  new: (): string => uuidv7(),
  newV4: (): string => randomUUID(),
  isValid: (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  },
};

export const now = (): Date => new Date();
