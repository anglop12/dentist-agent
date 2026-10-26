/**
 * Puerto de proveedor LLM (intercambiable).
 * Implementaciones: AnthropicProvider, OpenAIProvider, OllamaProvider.
 */

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface LLMMessage {
  role: MessageRole;
  content: string;
  toolName?: string;
  toolResult?: unknown;
}

export interface LLMToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMDecision {
  type: 'reply' | 'tool_call';
  text?: string;
  tool?: LLMToolCall;
  nextState?: string;
  tokensUsed?: { input: number; output: number };
}

export interface LLMOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LLMToolSpec[];
  stopSequences?: string[];
}

export interface ILLMProvider {
  readonly providerName: 'ollama' | 'anthropic' | 'openai';
  chat(messages: LLMMessage[], opts: LLMOpts): Promise<LLMDecision>;
  /** Streaming para WebSocket al cliente. */
  streamChat(messages: LLMMessage[], opts: LLMOpts): AsyncIterable<string>;
  countTokens(text: string): number;
  /** Embeddings (opcional, para RAG en F6). */
  embed?(text: string): Promise<number[]>;
  isHealthy(): Promise<boolean>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
