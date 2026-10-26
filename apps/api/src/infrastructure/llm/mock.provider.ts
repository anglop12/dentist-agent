import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMProvider,
  LLMDecision,
  LLMMessage,
  LLMOpts,
} from '../../domain/intelligence/llm.port';

/**
 * MockLLMProvider - respuestas predefinidas para desarrollo sin LLM.
 *
 * Se activa cuando no hay Ollama corriendo ni API keys configuradas.
 * Reconoce intenciones bÃ¡sicas del paciente (en espaÃ±ol) y ejecuta la tool
 * apropiada o responde con un mensaje genÃ©rico.
 *
 * âš ï¸  SOLO PARA DESARROLLO. En producciÃ³n usar Ollama/Anthropic/OpenAI.
 */
@Injectable()
export class MockLLMProvider implements ILLMProvider {
  readonly providerName = 'ollama' as const;
  private readonly logger = new Logger(MockLLMProvider.name);

  async chat(messages: LLMMessage[], opts: LLMOpts): Promise<LLMDecision> {
    this.logger.log(`[mock-llm] ${messages.length} msgs in context`);

    // Si el último mensaje es resultado de una tool, reaccionar a él.
    const last = messages[messages.length - 1];
    if (last?.role === 'tool') {
      try {
        const result = JSON.parse(last.content);
        if (result.found === true && result.patientId) {
          return {
            type: 'reply',
            text: `¡Gracias! Te encontré en nuestro sistema${result.firstName ? ', ' + result.firstName : ''}. ¿Para qué día te gustaría la cita?`,
            tokensUsed: { input: 0, output: 0 },
          };
        }
        if (result.found === false) {
          return {
            type: 'reply',
            text: 'No te encontré en nuestro sistema. ¿Me confirmas tu nombre completo para registrarte?',
            tokensUsed: { input: 0, output: 0 },
          };
        }
      } catch {
        /* contenido no-JSON, continuar */
      }
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = (lastUser?.content ?? '').toLowerCase().trim();
    this.logger.log(`[mock-llm] User said: "${text}"`);

    // DetecciÃ³n simple de intenciÃ³n.
    if (/hola|buenos|buenas|hi\b/.test(text)) {
      return {
        type: 'reply',
        text: 'Â¡Hola! Soy el asistente virtual de la clÃ­nica dental. Â¿En quÃ© puedo ayudarte? Puedes decirme cosas como "quiero una cita", "ver mis citas" o "cancelar".',
        tokensUsed: { input: 0, output: 0 },
      };
    }

    if (/cita|agendar|reservar|turno/.test(text)) {
      // Si hay tools disponibles y alguna es identify_patient, simular tool call.
      if (opts.tools?.some((t) => t.name === 'identify_patient')) {
        return {
          type: 'tool_call',
          tool: { name: 'identify_patient', input: { phone: '+584141234567' } },
          tokensUsed: { input: 0, output: 0 },
        };
      }
      return {
        type: 'reply',
        text: 'Para agendar una cita necesito tu nÃºmero de telÃ©fono. Â¿Me lo compartes?',
        tokensUsed: { input: 0, output: 0 },
      };
    }

    if (/cancelar/.test(text)) {
      return {
        type: 'reply',
        text: 'Â¿QuÃ© cita te gustarÃ­a cancelar? Dime la fecha o la hora y la cancelo.',
        tokensUsed: { input: 0, output: 0 },
      };
    }

    if (/ver|lista|mis citas/.test(text)) {
      return {
        type: 'reply',
        text: 'Tus citas activas estÃ¡n disponibles en el panel. Si quieres, te las envÃ­o por aquÃ­.',
        tokensUsed: { input: 0, output: 0 },
      };
    }

    if (/gracias|thanks/.test(text)) {
      return {
        type: 'reply',
        text: 'Â¡De nada! Cuando quieras agendar, solo escrÃ­beme. ï¿½',
        tokensUsed: { input: 0, output: 0 },
      };
    }

    return {
      type: 'reply',
      text: 'Entendido. Â¿Quieres que te ayude a agendar una cita, ver tus citas pendientes o cancelar alguna?',
      tokensUsed: { input: 0, output: 0 },
    };
  }

  async *streamChat(messages: LLMMessage[], _opts: LLMOpts): AsyncIterable<string> {
    const decision = await this.chat(messages, _opts);
    if (decision.text) {
      // Simula streaming palabra por palabra.
      for (const word of decision.text.split(/(\s+)/)) {
        yield word;
        await new Promise((r) => setTimeout(r, 30));
      }
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}
