import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/shared/errors/global-exception.filter';
import { ToolRegistry } from '../../src/domain/intelligence/tool';
import { ConversationFSM } from '../../src/domain/conversation/conversation-fsm';

describe('Tools e2e (F2 §4.2 catálogo inicial)', () => {
  let app: INestApplication;
  let tools: ToolRegistry;
  let fsm: ConversationFSM;

  beforeAll(async () => {
    process.env.DATABASE_URL = ':memory:';
    process.env.LLM_PROVIDER = 'ollama';
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    tools = app.get(ToolRegistry);
    fsm = app.get(ConversationFSM);
  });

  afterAll(async () => {
    await app.close();
  });

  const toolsToCheck = [
    'identify_patient',
    'list_doctors',
    'check_availability',
    'propose_slots',
    'create_appointment',
    'reschedule_appointment',
    'cancel_appointment',
    'send_message',
  ];

  for (const name of toolsToCheck) {
    it(`registers tool: ${name}`, () => {
      const t = tools.get(name);
      expect(t).toBeDefined();
      expect(t?.name).toBe(name);
      expect(t?.description).toBeTruthy();
      expect(t?.inputSchema).toBeDefined();
      expect(Array.isArray(t?.requiredPermissions)).toBe(true);
    });
  }

  it('every tool is gated by the FSM (no tool allowed in all states)', () => {
    const states: string[] = [
      'greeting', 'identifying_patient', 'collecting_intent', 'collecting_specialty',
      'collecting_doctor', 'showing_slots', 'awaiting_slot_choice', 'awaiting_payment',
      'confirming_appointment', 'awaiting_reschedule_choice', 'idle', 'closed',
    ];
    for (const t of toolsToCheck) {
      const allowedCount = states.filter((s) => fsm.canUseTool(s as any, t)).length;
      // Cada tool debe estar restringida en al menos un estado.
      expect(allowedCount).toBeLessThan(states.length);
    }
  });

  it('create_appointment is NEVER allowed in greeting', () => {
    expect(fsm.canUseTool('greeting', 'create_appointment')).toBe(false);
  });

  it('closed state allows no tools', () => {
    for (const t of toolsToCheck) {
      expect(fsm.canUseTool('closed', t)).toBe(false);
    }
  });

  it('Tool inputSchema validates with Zod', () => {
    const checkAvail = tools.get('check_availability');
    expect(checkAvail).toBeDefined();
    const parsed = checkAvail!.inputSchema.safeParse({
      doctorId: 'abc',
      date: '2026-08-21',
    });
    expect(parsed.success).toBe(true);

    const invalid = checkAvail!.inputSchema.safeParse({ doctorId: 'abc', date: 'invalid' });
    expect(invalid.success).toBe(false);
  });
});
