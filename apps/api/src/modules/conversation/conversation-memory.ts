import { Injectable, Logger, Inject } from '@nestjs/common';
import { LLMMessage, ILLMProvider, LLM_PROVIDER } from '../../domain/intelligence/llm.port';
import { Conversation, ConversationContext } from '../../domain/conversation/conversation.entity';
import { loadEnv } from '../../config/env';

/**
 * ConversationMemory - gestiona corto plazo (historial) y largo plazo (resumen).
 *
 * - **Corto plazo**: Ãºltimos N mensajes en `conversation.context.history`.
 * - **Largo plazo**: resumen comprimido cada K mensajes (vÃ­a otro LLM barato).
 * - **CompactaciÃ³n**: si supera M tokens â†’ resume lo antiguo a un solo mensaje "summary".
 */
@Injectable()
export class ConversationMemory {
  private readonly logger = new Logger(ConversationMemory.name);
  private readonly memoryWindow: number;
  private readonly compactThreshold: number;
  private readonly summarizeEvery: number;

  constructor(@Inject(LLM_PROVIDER) private readonly llm: ILLMProvider) {
    const env = loadEnv();
    this.memoryWindow = env.AGENT_MEMORY_WINDOW;
    this.compactThreshold = Math.floor(env.AGENT_TOKEN_BUDGET * 0.8);
    this.summarizeEvery = 10;
  }

  /**
   * Construye los mensajes para enviar al LLM, respetando el budget.
   * Si el historial es largo, lo resume para no exceder tokens.
   */
  buildMessages(conversation: Conversation, systemPrompt: string, tokenBudget: number): LLMMessage[] {
    const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

    // Resumen de mensajes antiguos (si existe)
    const summary = (conversation.context as any).summary as string | undefined;
    if (summary) {
      messages.push({
        role: 'system',
        content: `Resumen de la conversaciÃ³n previa: ${summary}`,
      });
    }

    // Mensajes recientes (Ãºltimos N)
    const recent = conversation.context.history.slice(-this.memoryWindow);
    for (const m of recent) {
      if (m.role === 'tool') {
        messages.push({
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          toolName: m.toolName,
        });
      } else {
        messages.push({ role: m.role as any, content: m.content });
      }
    }

    // Contexto adicional
    const ctxSummary = this.summarizeContext(conversation.context);
    if (ctxSummary) {
      messages.push({ role: 'system', content: `Estado actual: ${ctxSummary}` });
    }

    // Contexto temporal: el modelo NO conoce la fecha real. Sin esto,
    // tiende a usar años de su training (2023...) al interpretar "viernes".
    const now = new Date();
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const hoy = now.toISOString().slice(0, 10);
    const anio = now.getFullYear();
    const proxViernes = (() => {
      const d = new Date(now);
      if (d.getDay() !== 5) d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
      return d.toISOString().slice(0, 10);
    })();
    messages.push({
      role: 'system',
      content:
        `Contexto temporal: HOY es ${hoy} (${DIAS[now.getDay()]}), año ${anio}. ` +
        `El próximo viernes es ${proxViernes}. ` +
        `Cuando el usuario diga un día relativo ("mañana", "el viernes"), calcúlalo desde HOY. ` +
        `PROHIBIDO proponer o crear fechas de años pasados (ej. ${anio - 3}).`,
    });

    // Truncar si excede el budget (estimaciÃ³n grosera: ~4 chars por token)
    const maxChars = tokenBudget * 4;
    let totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
    while (totalChars > maxChars && messages.length > 3) {
      // Quitamos el segundo mensaje (despuÃ©s del system) - el mÃ¡s antiguo
      const removed = messages.splice(1, 1)[0];
      totalChars -= removed.content?.length ?? 0;
    }

    return messages;
  }

  /**
   * Decide si debe compactar y, si sÃ­, resume lo antiguo.
   * Llamar despuÃ©s de aÃ±adir mensajes nuevos.
   */
  async maybeCompact(conversation: Conversation): Promise<Conversation> {
    const history = conversation.context.history;
    if (history.length < this.summarizeEvery) return conversation;

    const tokenEstimate = this.estimateTokens(history);
    if (tokenEstimate < this.compactThreshold) return conversation;

    this.logger.log(`Compacting conversation ${conversation.id} (est. ${tokenEstimate} tokens)`);
    const summary = await this.summarize(history.slice(0, -this.summarizeEvery));
    conversation.patchContext({
      history: history.slice(-this.summarizeEvery),
      summary,
    } as any);
    return conversation;
  }

  /** Resumen simple (sin LLM) - Ãºtil como fallback. */
  summarizeContext(ctx: ConversationContext): string {
    const parts: string[] = [];
    if (ctx.patientId) parts.push(`patientId=${ctx.patientId}`);
    if (ctx.doctorId) parts.push(`doctorId=${ctx.doctorId}`);
    if (ctx.specialtyId) parts.push(`specialtyId=${ctx.specialtyId}`);
    if (ctx.date) parts.push(`date=${ctx.date}`);
    if (ctx.time) parts.push(`time=${ctx.time}`);
    if (ctx.intent) parts.push(`intent=${ctx.intent}`);
    return parts.join(', ');
  }

  /** Resumen con LLM (barato) - opcional. */
  async summarize(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (messages.length === 0) return '';
    try {
      const text = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')
        .slice(0, 4000);
      const decision = await this.llm.chat(
        [
          {
            role: 'system',
            content: 'Resume la siguiente conversaciÃ³n de un paciente con una clÃ­nica dental en mÃ¡ximo 200 caracteres. MantÃ©n datos clave: nombre, motivo, fecha preferida.',
          },
          { role: 'user', content: text },
        ],
        { maxTokens: 100 },
      );
      return decision.type === 'reply' ? decision.text ?? '' : '';
    } catch (e) {
      this.logger.warn(`Summarization failed: ${(e as Error).message}`);
      return messages.slice(-3).map((m) => `${m.role}: ${m.content.slice(0, 100)}`).join(' | ');
    }
  }

  private estimateTokens(messages: Array<{ content: string }>): number {
    const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
    return Math.ceil(totalChars / 4);
  }
}
