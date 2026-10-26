import { describe, expect, it } from 'vitest';
import { ConversationFSM } from './conversation-fsm';

describe('ConversationFSM', () => {
  const fsm = new ConversationFSM();

  it('allows greeting -> identifying_patient', () => {
    expect(fsm.canTransition('greeting', 'identifying_patient')).toBe(true);
  });

  it('forbids greeting -> confirming_appointment', () => {
    expect(fsm.canTransition('greeting', 'confirming_appointment')).toBe(false);
  });

  it('allows create_appointment only in awaiting_slot_choice/confirming', () => {
    expect(fsm.canUseTool('greeting', 'create_appointment')).toBe(false);
    expect(fsm.canUseTool('awaiting_slot_choice', 'create_appointment')).toBe(true);
    expect(fsm.canUseTool('confirming_appointment', 'create_appointment')).toBe(true);
  });

  it('allows list_doctors in many states', () => {
    expect(fsm.canUseTool('collecting_intent', 'list_doctors')).toBe(true);
    expect(fsm.canUseTool('showing_slots', 'list_doctors')).toBe(false);
  });

  it('closed is terminal', () => {
    expect(fsm.canTransition('closed', 'greeting')).toBe(false);
  });
});
