import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ILLMProvider, LLMDecision, LLMMessage, LLMToolSpec, LLM_PROVIDER } from '../../domain/intelligence/llm.port';
import { Conversation } from '../../domain/conversation/conversation.entity';
import { ConversationFSM } from '../../domain/conversation/conversation-fsm';
import { ToolRegistry, TOOL_REGISTRY } from '../../domain/intelligence/tool';
import { ConversationMemory } from './conversation-memory';
import { buildSystemPrompt } from './agent-prompt';
import { loadEnv } from '../../config/env';

/**
 * PlannerService - construye el prompt para el LLM y obtiene la decisiÃ³n.
 * Separa la lÃ³gica de prompting del orquestador.
 */
@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);
  private readonly tokenBudget: number;

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: ILLMProvider,
    @Inject(TOOL_REGISTRY) private readonly tools: ToolRegistry,
    private readonly fsm: ConversationFSM,
    private readonly memory: ConversationMemory,
  ) {
    this.tokenBudget = loadEnv().AGENT_TOKEN_BUDGET;
  }

  /**
   * Construye los mensajes para el LLM, respetando el budget de tokens.
   * Devuelve solo las tools permitidas en el estado actual (FSM guardarraÃ­l).
   */
  async plan(conversation: Conversation): Promise<LLMDecision> {
    const systemPrompt = buildSystemPrompt();
    const messages = this.memory.buildMessages(conversation, systemPrompt, this.tokenBudget);
    const allowedTools = this.tools.specs().filter((t) =>
      this.fsm.canUseTool(conversation.state, t.name),
    );
    return this.llm.chat(messages, {
      tools: allowedTools,
      maxTokens: 2048,
    });
  }

  /**
   * VersiÃ³n streaming: devuelve tokens al cliente mientras planifica.
   * (Si el LLM llama tool, no hay tokens de texto - solo se emite cuando termina).
   */
  async *planStream(conversation: Conversation): AsyncIterable<string> {
    const systemPrompt = buildSystemPrompt();
    const messages = this.memory.buildMessages(conversation, systemPrompt, this.tokenBudget);
    const allowedTools = this.tools.specs().filter((t) =>
      this.fsm.canUseTool(conversation.state, t.name),
    );
    yield* this.llm.streamChat(messages, { tools: allowedTools, maxTokens: 2048 });
  }

  /**
   * Reconstruye el contexto con el resultado de un tool call para re-preguntar al LLM.
   */
  buildFollowupMessages(
    messages: LLMMessage[],
    toolName: string,
    result: unknown,
  ): LLMMessage[] {
    return [
      ...messages,
      { role: 'tool', content: JSON.stringify(result), toolName },
    ];
  }
}
