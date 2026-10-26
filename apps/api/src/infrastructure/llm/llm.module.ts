import { Global, Module, Provider, Logger } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import { LLM_PROVIDER } from '../../domain/intelligence/llm.port';
import { OllamaProvider } from './ollama.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';
import { MockLLMProvider } from './mock.provider';

const log = new Logger('LLMFactory');

async function checkOllama(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const LLMFactory: Provider = {
  provide: LLM_PROVIDER,
  useFactory: async () => {
    const env = loadEnv();
    switch (env.LLM_PROVIDER) {
      case 'ollama': {
        const healthy = await checkOllama(env.OLLAMA_BASE_URL);
        if (healthy) {
          log.log(`Ollama healthy at ${env.OLLAMA_BASE_URL} â†’ using ${env.LLM_MODEL}`);
          return new OllamaProvider(env.OLLAMA_BASE_URL, env.LLM_MODEL);
        }
        log.warn(`Ollama NOT available at ${env.OLLAMA_BASE_URL}. Using MockLLMProvider.`);
        return new MockLLMProvider();
      }
      case 'anthropic':
        if (!env.ANTHROPIC_API_KEY) {
          log.warn(`ANTHROPIC_API_KEY missing â†’ using MockLLMProvider`);
          return new MockLLMProvider();
        }
        return new AnthropicProvider(
          'https://api.anthropic.com',
          env.ANTHROPIC_API_KEY,
          env.ANTHROPIC_MODEL,
        );
      case 'openai':
        if (!env.OPENAI_API_KEY) {
          log.warn(`OPENAI_API_KEY missing → using MockLLMProvider`);
          return new MockLLMProvider();
        }
        return new OpenAIProvider('https://api.openai.com/v1', env.OPENAI_API_KEY, env.OPENAI_MODEL);

      case 'openrouter': {
        if (!env.OPENROUTER_API_KEY) {
          log.warn(`OPENROUTER_API_KEY missing (grátis en openrouter.ai/keys) → using MockLLMProvider`);
          return new MockLLMProvider();
        }
        log.log(`OpenRouter listo → modelo ${env.OPENROUTER_MODEL}`);
        // OpenRouter es OpenAI-compatible. Los headers de atribución son
        // recomendados por OpenRouter para identificar la app en su dashboard.
        const fallbacks = env.OPENROUTER_MODELS.split(',').map((s) => s.trim()).filter(Boolean);
        if (fallbacks.length) {
          log.log(
            `Failover chain (${fallbacks.length + 1} modelos): ${env.OPENROUTER_MODEL} → ${fallbacks.join(' → ')}`,
          );
        }
        return new OpenAIProvider(
          env.OPENROUTER_BASE_URL,
          env.OPENROUTER_API_KEY,
          env.OPENROUTER_MODEL,
          {
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Agente Odontologico IA',
          },
          fallbacks,
        );
      }

      case 'mock':
        log.log('Using MockLLMProvider (explicit)');
        return new MockLLMProvider();
      default:
        return new MockLLMProvider();
    }
  },
};

@Global()
@Module({
  providers: [LLMFactory],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
