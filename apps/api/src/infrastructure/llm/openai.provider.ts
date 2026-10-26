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
 * Adapter OpenAI. Compatible con cualquier endpoint OpenAI-compatible
 * (azure, groq, openrouter, etc.) vÃ­a baseUrl configurable.
 */
@Injectable()
export class OpenAIProvider implements ILLMProvider {
  readonly providerName = 'openai' as const;
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly http: HttpClient;
  // Cadena de failover: [principal, ...respaldos]. Declarada ANTES del ctor
  // para que useDefineForClassFields no la pise con undefined.
  private readonly models: string[];

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultModel: string,
    extraHeaders: Record<string, string> = {},
    fallbackModels: string[] = [],
  ) {
    this.http = new HttpClient({
      baseUrl,
      apiKey,
      defaultHeaders: extraHeaders,
      timeoutMs: 120_000,
    });
    this.models = [defaultModel, ...fallbackModels].filter(Boolean);
  }

  async chat(messages: LLMMessage[], opts: LLMOpts): Promise<LLMDecision> {
    let lastError: Error | null = null;

    this.logger.log(`[failover-debug] cadena=${JSON.stringify(this.models)} len=${this.models?.length}`);

    for (const model of this.models) {
      try {
        const body = {
          model,
          messages: this.toOpenAIMessages(messages),
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 2048,
          ...(opts.tools?.length ? { tools: this.toOpenAITools(opts.tools), tool_choice: 'auto' } : {}),
        };

        const res = await this.http.post<OpenAIResponse>('/chat/completions', body);
        return this.fromOpenAI(res);
      } catch (e) {
        lastError = e as Error;
        const msg = (e as Error).message;

        // 401/403 = problema de API key: reintentar con otro modelo no ayuda.
        if (/\b40[13]\b/.test(msg)) {
          this.logger.error(`API key rechazada (${msg.slice(0, 120)}). Abortando.`);
          break;
        }

        if (this.models.length > 1) {
          this.logger.warn(
            `Modelo "${model}" falló (${msg.slice(0, 100)}) → probando siguiente de la cadena…`,
          );
        }
      }
    }

    this.logger.error(`Todos los modelos fallaron. Último error: ${lastError?.message}`);
    throw new LLMError(lastError?.message ?? 'unknown', 'openai');
  }

  async *streamChat(messages: LLMMessage[], opts: LLMOpts): AsyncIterable<string> {
    const body = {
      model: opts.model ?? this.defaultModel,
      messages: this.toOpenAIMessages(messages),
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
    };

    const stream = await this.http.postStream('/chat/completions', body);
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
          if (data === '[DONE]') return;
          if (!data) continue;
          try {
            const ev = JSON.parse(data) as OpenAIStreamEvent;
            const chunk = ev.choices?.[0]?.delta?.content;
            if (chunk) yield chunk;
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
    return Math.ceil(text.length / 4);
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey;
  }

  private toOpenAIMessages(messages: LLMMessage[]): any[] {
    return messages.map((m) => ({
      role: m.role === 'tool' ? 'tool' : m.role,
      content: m.content,
      ...(m.role === 'tool' ? { tool_call_id: m.toolName ?? 'tool' } : {}),
    }));
  }

  private toOpenAITools(tools: LLMToolSpec[]): any[] {
    return tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  private fromOpenAI(res: OpenAIResponse): LLMDecision {
    const choice = res.choices[0];
    const toolCall = choice.message.tool_calls?.[0];
    if (toolCall && toolCall.function) {
      return {
        type: 'tool_call',
        tool: {
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || '{}'),
        },
        tokensUsed: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 },
      };
    }
    return {
      type: 'reply',
      text: choice.message.content ?? '',
      tokensUsed: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 },
    };
  }
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{ function: { name: string; arguments: string } }>;
    };
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface OpenAIStreamEvent {
  choices?: Array<{ delta?: { content?: string } }>;
}
