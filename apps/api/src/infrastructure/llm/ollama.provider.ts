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
 * Adapter Ollama - local, gratis, sin enviar PHI fuera del consultorio.
 * Default: qwen2.5:7b. Soporta tool use nativo en modelos recientes.
 */
@Injectable()
export class OllamaProvider implements ILLMProvider {
  readonly providerName = 'ollama' as const;
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly http: HttpClient;

  constructor(private readonly baseUrl: string, private readonly defaultModel: string) {
    this.http = new HttpClient({
      baseUrl,
      timeoutMs: 300_000, // ReAct multi-iteración puede tardar
    });
  }

  async chat(messages: LLMMessage[], opts: LLMOpts): Promise<LLMDecision> {
    try {
      const body = {
        model: opts.model ?? this.defaultModel,
        messages: this.toOllamaMessages(messages),
        stream: false,
        // qwen3 y otros modelos "thinking": desactivable vía LLM_THINKING=true
        think: process.env.LLM_THINKING === 'true',
        options: {
          temperature: opts.temperature ?? 0.2,
          num_predict: opts.maxTokens ?? 2048,
          stop: opts.stopSequences,
        },
        tools: opts.tools?.length ? this.toOllamaTools(opts.tools) : undefined,
      };

      const res = await this.http.post<OllamaChatResponse>('/api/chat', body);
      return this.fromOllamaResponse(res);
    } catch (e) {
      this.logger.error(`Ollama chat error: ${(e as Error).message}`);
      throw new LLMError((e as Error).message, 'ollama');
    }
  }

  async *streamChat(messages: LLMMessage[], opts: LLMOpts): AsyncIterable<string> {
    const body = {
      model: opts.model ?? this.defaultModel,
      messages: this.toOllamaMessages(messages),
      stream: true,
      think: process.env.LLM_THINKING === 'true',
      options: {
        temperature: opts.temperature ?? 0.2,
        num_predict: opts.maxTokens ?? 2048,
      },
    };

    const stream = await this.http.postStream('/api/chat', body);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n').filter(Boolean)) {
          try {
            const obj = JSON.parse(line) as OllamaStreamChunk;
            if (obj.message?.content) yield obj.message.content;
            if (obj.done) return;
          } catch {
            /* ignore malformed line */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  countTokens(text: string): number {
    // AproximaciÃ³n: ~4 chars por token.
    return Math.ceil(text.length / 4);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.http.get('/api/tags');
      return true;
    } catch {
      return false;
    }
  }

  private toOllamaMessages(messages: LLMMessage[]): any[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private toOllamaTools(tools: LLMToolSpec[]): any[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  private fromOllamaResponse(res: OllamaChatResponse): LLMDecision {
    const msg = res.message;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const tc = msg.tool_calls[0];
      return {
        type: 'tool_call',
        tool: {
          name: tc.function.name,
          input: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        },
        tokensUsed: {
          input: res.prompt_eval_count ?? 0,
          output: res.eval_count ?? 0,
        },
      };
    }
    return {
      type: 'reply',
      text: msg.content ?? '',
      tokensUsed: {
        input: res.prompt_eval_count ?? 0,
        output: res.eval_count ?? 0,
      },
    };
  }
}

interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{ function: { name: string; arguments: any } }>;
  };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  message?: { content?: string };
  done?: boolean;
}
