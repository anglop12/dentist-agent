import { z } from 'zod';
import { Logger } from '@nestjs/common';

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<script\b[^>]*>/i, reason: 'script tag' },
  { pattern: /javascript:/i, reason: 'javascript URI' },
  { pattern: /on\w+\s*=/i, reason: 'event handler attribute' },
  { pattern: /data:text\/html/i, reason: 'data URI HTML' },
  { pattern: /\b(rm|unlink|drop|delete)\s+-rf?\b/i, reason: 'shell destructive command' },
];

const MAX_LENGTH = 4096;

/**
 * OutputSanitizer - valida el texto que el agente quiere enviar al paciente.
 * Rechaza contenido peligroso o excesivamente largo.
 */
export class OutputSanitizer {
  private static readonly logger = new Logger(OutputSanitizer.name);

  static sanitize(text: string): { ok: true; text: string } | { ok: false; reason: string } {
    if (!text || typeof text !== 'string') {
      return { ok: false, reason: 'empty_text' };
    }
    if (text.length > MAX_LENGTH) {
      OutputSanitizer.logger.warn(`Truncating output: ${text.length} > ${MAX_LENGTH}`);
      text = text.slice(0, MAX_LENGTH - 3) + '...';
    }
    for (const { pattern, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(text)) {
        OutputSanitizer.logger.warn(`Blocked output (${reason}): ${text.slice(0, 80)}`);
        return { ok: false, reason };
      }
    }
    return { ok: true, text };
  }

  static assertSafe(text: string): string {
    const res = this.sanitize(text);
    if (!res.ok) {
      throw new Error(`Unsafe output: ${res.reason}`);
    }
    return res.text;
  }
}

export const SafeTextSchema = z
  .string()
  .max(MAX_LENGTH)
  .refine((t) => !DANGEROUS_PATTERNS.some((p) => p.pattern.test(t)), {
    message: 'Output contains dangerous patterns',
  });
