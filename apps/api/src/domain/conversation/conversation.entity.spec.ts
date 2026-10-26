import { describe, expect, it } from 'vitest';
import { Conversation } from './conversation.entity';

describe('Conversation entity', () => {
  it('creates with greeting state', () => {
    const c = Conversation.create({
      id: 'c-1',
      channel: 'whatsapp',
      externalId: '+584141234567',
    });
    expect(c.state).toBe('greeting');
    expect(c.context.history).toEqual([]);
  });

  it('transitions state', () => {
    const c = Conversation.create({
      id: 'c-1',
      channel: 'whatsapp',
      externalId: '+584141234567',
    });
    c.transitionTo('identifying_patient');
    expect(c.state).toBe('identifying_patient');
  });

  it('pushes messages', () => {
    const c = Conversation.create({
      id: 'c-1',
      channel: 'whatsapp',
      externalId: '+584141234567',
    });
    c.pushMessage({ role: 'user', content: 'hola', at: new Date() });
    c.pushMessage({ role: 'assistant', content: 'hola!', at: new Date() });
    expect(c.context.history).toHaveLength(2);
  });

  it('patches context', () => {
    const c = Conversation.create({
      id: 'c-1',
      channel: 'whatsapp',
      externalId: '+584141234567',
    });
    c.patchContext({ patientId: 'p-1', doctorId: 'd-1' });
    expect(c.context.patientId).toBe('p-1');
  });
});
