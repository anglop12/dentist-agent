/**
 * Contrato de Tool del agente.
 * PatrÃ³n Strategy + Decorator: cada tool se registra con nombre, schema Zod,
 * descripciÃ³n semÃ¡ntica, permisos y funciÃ³n ejecutora.
 */

import { z } from 'zod';

export interface ToolContext {
  /** ID de conversación actual. */
  conversationId: string;
  /** Canal por el que entró el mensaje. */
  channel: string;
  /** Estado actual de la FSM. */
  state: string;
  /** patientId actualmente identificado (si lo hay). Se auto-inyecta
   *  en tools que lo requieran, evitando que el LLM olvide pasarlo. */
  patientId?: string;
  /** Acceso a use cases (inyectado por el tool registry). */
  deps: Record<string, any>;
}

export interface Tool<P extends z.ZodTypeAny = z.ZodTypeAny, R = unknown> {
  name: string;
  description: string;
  inputSchema: P;
  outputSchema?: z.ZodTypeAny;
  requiredPermissions: string[];
  execute(input: z.infer<P>, ctx: ToolContext): Promise<R>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  specs(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: this.zodToJsonSchema(t.inputSchema),
    }));
  }

  private zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    const candidate = schema as unknown as { toJSON?: () => Record<string, unknown> };
    try {
      return typeof candidate.toJSON === 'function' ? candidate.toJSON() : {};
    } catch {
      return {};
    }
  }
}

export const TOOL_REGISTRY = Symbol('TOOL_REGISTRY');
