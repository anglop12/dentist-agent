import { Conversation, ConversationContext } from './conversation.entity';
import { ConversationState } from './conversation-fsm';

export interface IConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByChannelExternalId(channel: string, externalId: string): Promise<Conversation | null>;
  findActiveByExternalId(externalId: string): Promise<Conversation | null>;
  list(opts?: { limit?: number; offset?: number }): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IMessageRepository {
  append(args: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolName?: string;
    toolResult?: unknown;
    tokens?: number;
  }): Promise<void>;
  recent(conversationId: string, limit?: number): Promise<
    Array<{
      role: string;
      content: string;
      toolName?: string;
      toolResult?: unknown;
      tokens?: number;
      at: Date;
    }>
  >;
}

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');

export type { ConversationContext };
export { ConversationState };
