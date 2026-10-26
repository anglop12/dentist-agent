import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRegistry, Tool, ToolContext, TOOL_REGISTRY } from '../../domain/intelligence/tool';
import { z } from 'zod';
import { ToolExecutionError } from '../../shared/errors/domain.errors';
import { MetricsCollector } from '../../infrastructure/observability/metrics';

export interface ExecutionResult {
  ok: boolean;
  tool: string;
  result?: unknown;
  error?: string;
  validationErrors?: Array<{ path: string; message: string }>;
}

/**
 * ExecutorService - ejecuta tool calls validados.
 * Responsabilidades:
 *   1. Validar input con Zod (rechaza si no pasa).
 *   2. Ejecutar la tool con el contexto inyectado.
 *   3. Capturar errores y emitirlos a mÃ©tricas.
 *   4. Nunca propagar la excepciÃ³n al planner (devuelve ExecutionResult).
 */
@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  constructor(
    @Inject(TOOL_REGISTRY) private readonly tools: ToolRegistry,
    private readonly metrics: MetricsCollector,
  ) {}

  async execute(
    toolName: string,
    rawInput: unknown,
    ctx: ToolContext,
  ): Promise<ExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      this.logger.warn(`[executor] tool not found: ${toolName}. Registered: ${this.tools.names().join(',')}`);
      this.metrics.toolCalls.inc({ tool: toolName, outcome: 'unknown_tool' });
      return { ok: false, tool: toolName, error: `Unknown tool: ${toolName}` };
    }

    // 1. Auto-inyección de patientId: si el schema lo requiere pero el LLM
    //    no lo incluyó, lo tomamos del contexto de conversación.
    const rawInputRecord =
      rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
        ? { ...(rawInput as Record<string, unknown>) }
        : {};
    if (
      rawInputRecord.patientId === undefined &&
      typeof ctx.patientId === 'string' &&
      ctx.patientId.length > 0
    ) {
      const schemaShape =
        (tool.inputSchema as unknown as { _def?: { shape?: () => Record<string, unknown> } })._def
          ?.shape?.() ?? {};
      if (schemaShape && 'patientId' in schemaShape) {
        rawInputRecord.patientId = ctx.patientId;
        this.logger.log(
          `[executor] auto-injecting patientId=${ctx.patientId} into ${toolName}`,
        );
      }
    }

    // 2. Validación con Zod
    const parsed = tool.inputSchema.safeParse(rawInputRecord);
    if (!parsed.success) {
      this.logger.warn(`[executor] validation failed for ${toolName}: ${JSON.stringify(parsed.error.issues)}`);
      this.metrics.toolCalls.inc({ tool: toolName, outcome: 'validation_error' });
      return {
        ok: false,
        tool: toolName,
        error: 'validation_error',
        validationErrors: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      };
    }

    // 2. EjecuciÃ³n
    try {
      const result = await tool.execute(parsed.data, ctx);
      this.metrics.toolCalls.inc({ tool: toolName, outcome: 'success' });
      return { ok: true, tool: toolName, result };
    } catch (e) {
      this.logger.error(`Tool ${toolName} threw: ${(e as Error).message}`);
      this.metrics.toolCalls.inc({ tool: toolName, outcome: 'error' });
      return { ok: false, tool: toolName, error: (e as Error).message };
    }
  }

  /** Lista tools disponibles en un estado (para inspecciÃ³n/debug). */
  listForState(state: string): Tool[] {
    return this.tools
      .list()
      .filter((t) => this.tools.specs().some((s) => s.name === t.name));
  }
}
