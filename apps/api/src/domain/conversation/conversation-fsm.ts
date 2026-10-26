/**
 * Estados posibles de la conversaciÃ³n del agente con el paciente.
 * Restringe quÃ© tools puede invocar (guardarraÃ­l crÃ­tico).
 */

export type ConversationState =
  | 'greeting'
  | 'identifying_patient'
  | 'collecting_intent'
  | 'collecting_specialty'
  | 'collecting_doctor'
  | 'showing_slots'
  | 'awaiting_slot_choice'
  | 'awaiting_payment'
  | 'confirming_appointment'
  | 'awaiting_reschedule_choice'
  | 'idle'
  | 'closed';

export const CONVERSATION_STATES: ConversationState[] = [
  'greeting',
  'identifying_patient',
  'collecting_intent',
  'collecting_specialty',
  'collecting_doctor',
  'showing_slots',
  'awaiting_slot_choice',
  'awaiting_payment',
  'confirming_appointment',
  'awaiting_reschedule_choice',
  'idle',
  'closed',
];

const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  greeting: ['identifying_patient', 'collecting_intent', 'idle', 'closed'],
  identifying_patient: ['collecting_intent', 'closed'],
  collecting_intent: [
    'collecting_specialty',
    'collecting_doctor',
    'showing_slots',
    'awaiting_reschedule_choice',
    'idle',
    'closed',
  ],
  collecting_specialty: ['collecting_doctor', 'closed'],
  collecting_doctor: ['showing_slots', 'closed'],
  showing_slots: ['awaiting_slot_choice', 'confirming_appointment', 'idle', 'closed'],
  awaiting_slot_choice: ['awaiting_payment', 'confirming_appointment', 'showing_slots', 'idle', 'closed'],
  awaiting_payment: ['confirming_appointment', 'closed'],
  confirming_appointment: ['idle', 'closed'],
  awaiting_reschedule_choice: ['showing_slots', 'idle', 'closed'],
  idle: ['greeting', 'collecting_intent', 'showing_slots', 'awaiting_reschedule_choice', 'closed'],
  closed: [],
};

/** Tools permitidas por estado. Si la tool no estÃ¡ aquÃ­, NO se ejecuta. */
const ALLOWED_TOOLS: Record<ConversationState, string[]> = {
  // Las de solo-lectura (list_doctors, check_availability, find_my_appointments)
  // estÃ¡n disponibles en todos los estados activos: consultar nunca corrompe.
  greeting: [
    'identify_patient', 'send_message', 'list_doctors',
    'check_availability', 'find_my_appointments',
  ],
  identifying_patient: [
    'identify_patient', 'send_message', 'find_my_appointments',
  ],
  collecting_intent: [
    'identify_patient', 'list_doctors', 'check_availability', 'send_message',
    'reschedule_appointment', 'cancel_appointment', 'find_my_appointments',
  ],
  collecting_specialty: [
    'list_doctors', 'send_message', 'find_my_appointments',
  ],
  collecting_doctor: [
    'list_doctors', 'check_availability', 'send_message', 'find_my_appointments',
  ],
  showing_slots: [
    'propose_slots', 'create_appointment', 'send_message', 'check_availability',
    'reschedule_appointment', 'find_my_appointments',
  ],
  awaiting_slot_choice: [
    'propose_slots', 'create_appointment', 'send_message', 'find_my_appointments',
    'reschedule_appointment',
  ],
  awaiting_payment: ['send_payment_link', 'send_message', 'find_my_appointments'],
  confirming_appointment: [
    'create_appointment', 'send_message', 'check_availability',
    'reschedule_appointment', 'cancel_appointment', 'find_my_appointments',
  ],
  awaiting_reschedule_choice: [
    'check_availability', 'propose_slots', 'send_message',
    'reschedule_appointment', 'find_my_appointments',
  ],
  idle: [
    'identify_patient', 'send_message', 'list_doctors',
    'check_availability', 'find_my_appointments',
    'reschedule_appointment', 'cancel_appointment',
  ],
  closed: [],
};

export class ConversationFSM {
  canTransition(from: ConversationState, to: ConversationState): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  }

  assertTransition(from: ConversationState, to: ConversationState): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid FSM transition: ${from} -> ${to}`);
    }
  }

  canUseTool(state: ConversationState, toolName: string): boolean {
    return ALLOWED_TOOLS[state]?.includes(toolName) ?? false;
  }

  allowedTools(state: ConversationState): string[] {
    return ALLOWED_TOOLS[state] ?? [];
  }
}
