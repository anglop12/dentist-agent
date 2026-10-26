import { ConversationState } from './conversation-fsm';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  toolName?: string;
  toolResult?: unknown;
  tokens?: number;
  at: Date;
}

/**
 * Snapshot del estado de la conversación.
 * Se persiste en BD y se reconstruye al recibir un mensaje.
 */
export interface ConversationContext {
  conversationId: string;
  channel: string;
  externalId: string;
  patientId?: string;
  doctorId?: string;
  specialtyId?: string;
  date?: string;
  time?: string;
  proposedSlots?: string[];
  intent?: 'schedule' | 'cancel' | 'reschedule' | 'inquiry';
  pendingAppointmentId?: string;
  paymentIntentId?: string;
  notes?: Record<string, unknown>;
  history: ConversationMessage[];
  lastToolResult?: unknown;
  userMessage?: string;
}

export class Conversation {
  private constructor(
    public readonly id: string,
    public readonly channel: string,
    public readonly externalId: string,
    public state: ConversationState,
    public context: ConversationContext,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public readonly metadata: Record<string, unknown> | null,
  ) {}

  static create(props: {
    id: string;
    channel: string;
    externalId: string;
    state?: ConversationState;
    metadata?: Record<string, unknown> | null;
  }): Conversation {
    const now = new Date();
    return new Conversation(
      props.id,
      props.channel,
      props.externalId,
      props.state ?? 'greeting',
      {
        conversationId: props.id,
        channel: props.channel,
        externalId: props.externalId,
        history: [],
      },
      now,
      now,
      props.metadata ?? null,
    );
  }

  static reconstitute(props: {
    id: string;
    channel: string;
    externalId: string;
    state: ConversationState;
    context: ConversationContext;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, unknown> | null;
  }): Conversation {
    return new Conversation(
      props.id,
      props.channel,
      props.externalId,
      props.state,
      props.context,
      props.createdAt,
      props.updatedAt,
      props.metadata,
    );
  }

  transitionTo(state: ConversationState): void {
    this.state = state;
    this.updatedAt = new Date();
  }

  pushMessage(msg: ConversationMessage): void {
    this.context.history.push(msg);
    this.updatedAt = new Date();
  }

  patchContext(patch: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...patch };
    this.updatedAt = new Date();
  }
}
