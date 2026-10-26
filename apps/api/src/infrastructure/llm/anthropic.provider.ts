import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMProvider,
  LLMDecision,
  LLMMessage,
  LLMOpts,
  LLMToolSpec,
} from '../../domain/intelligence/llm.port';
import { LLMError } from '../../shared/errors/domain.errors';
import { HttpClient } from './http-client';

/**
 * Adapter Anthropic Claude. Usa Messages API con tool use nativo.
 * Modelo por defecto: claude-3-5-haiku-latest (rÃ¡pido y barato).
 */
@Injectable()
export class AnthropicProvider implements ILLMProvider {
  readonly providerName = 'anthropic' as const;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly http: HttpClient;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.http = new HttpClient({
      baseUrl,
      apiKey,
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      timeoutMs: 120_000,
    });
  }

  async chat(messages: LLMMessage[], opts: LLMOpts): Promise<LLMDecision> {
    try {
      const { system, msgs } = this.splitSystem(messages);
      const body = {
        model: opts.model ?? this.defaultModel,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.2,
        system,
        messages: msgs,
        ...(opts.tools?.length ? { tools: this.toAnthropicTools(opts.tools) } : {}),
        ...(opts.stopSequences ? { stop_sequences: opts.stopSequences } : {}),
      };

      const res = await this.http.post<AnthropicResponse>('/v1/messages', body);
      return this.fromAnthropic(res);
    } catch (e) {
      this.logger.error(`Anthropic error: ${(e as Error).message}`);
      throw new LLMError((e as Error).message, 'anthropic');
    }
  }

  async *streamChat(messages: LLMMessage[], opts: LLMOpts): AsyncIterable<string> {
    const { system, msgs } = this.splitSystem(messages);
    const body = {
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.2,
      system,
      messages: msgs,
      stream: true,
    };

    const stream = await this.http.postStream('/v1/messages', body);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data) as AnthropicStreamEvent;
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              yield ev.delta.text ?? '';
            }
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey;
  }

  private splitSystem(messages: LLMMessage[]): { system?: string; msgs: any[] } {
    const system = messages.find((m) => m.role === 'system')?.content;
    const msgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.role === 'tool'
          ? [{ type: 'tool_result', tool_use_id: m.toolName ?? 'tool', content: m.content }]
          : m.content,
      }));
    return { system, msgs };
  }

  private toAnthropicTools(tools: LLMToolSpec[]): any[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  private fromAnthropic(res: AnthropicResponse): LLMDecision {
    const toolBlock = res.content.find((b) => b.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      return {
        type: 'tool_call',
        tool: { name: toolBlock.name, input: toolBlock.input as Record<string, unknown> },
        tokensUsed: { input: res.usage.input_tokens, output: res.usage.output_tokens },
      };
    }
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => ((b as any).text ?? ''))
      .join('');
    return {
      type: 'reply',
      text,
      tokensUsed: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    };
  }
}

interface AnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; name: string; input: Record<string, unknown>; id: string }
  >;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}
