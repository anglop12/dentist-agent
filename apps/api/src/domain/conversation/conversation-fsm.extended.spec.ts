import { describe, expect, it } from 'vitest';
import { ConversationFSM } from './conversation-fsm';
import { Conversation, ConversationContext } from './conversation.entity';
import { ConversationState } from './conversation-fsm';

describe('ConversationFSM - extended', () => {
  const fsm = new ConversationFSM();

  it('restricts create_appointment outside valid states', () => {
    const restricted: ConversationState[] = ['greeting', 'identifying_patient', 'collecting_intent', 'collecting_specialty', 'collecting_doctor', 'showing_slots', 'awaiting_payment', 'awaiting_reschedule_choice', 'idle'];
    const allowed: ConversationState[] = ['awaiting_slot_choice', 'confirming_appointment'];

    for (const s of restricted) {
      expect(fsm.canUseTool(s, 'create_appointment')).toBe(false);
    }
    for (const s of allowed) {
      expect(fsm.canUseTool(s, 'create_appointment')).toBe(true);
    }
  });

  it('allows send_message in most states', () => {
    const states: ConversationState[] = ['greeting', 'identifying_patient', 'collecting_intent', 'showing_slots', 'awaiting_slot_choice', 'idle'];
    for (const s of states) {
      expect(fsm.canUseTool(s, 'send_message')).toBe(true);
    }
  });

  it('closed allows no tools', () => {
    const tools = ['identify_patient', 'list_doctors', 'check_availability', 'create_appointment', 'send_message'];
    for (const t of tools) {
      expect(fsm.canUseTool('closed', t)).toBe(false);
    }
  });

  it('returns allowed tools per state', () => {
    const allowed = fsm.allowedTools('greeting');
    expect(allowed).toContain('identify_patient');
    expect(allowed).toContain('send_message');
  });
});
