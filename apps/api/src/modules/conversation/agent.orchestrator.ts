import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ToolRegistry, TOOL_REGISTRY } from '../../domain/intelligence/tool';
import { ConversationFSM, ConversationState } from '../../domain/conversation/conversation-fsm';
import {
  IConversationRepository,
  IMessageRepository,
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
} from '../../domain/conversation/repositories';
import { Conversation } from '../../domain/conversation/conversation.entity';
import { IncomingMessage, OutgoingMessage, IChannel } from '../../domain/communication/channel.port';
import { Id } from '../../shared/utils/id.util';
import { IClock, CLOCK } from '../../shared/utils/clock.util';
import { loadEnv } from '../../config/env';
import { PlannerService } from './planner.service';
import { ExecutorService } from './executor.service';
import { ConversationMemory } from './conversation-memory';
import { ChannelFactory } from '../communication/channel.factory';
import { IdentifyPatientTool } from './tools/identify-patient.tool';
import { ListDoctorsTool } from './tools/list-doctors.tool';
import { CheckAvailabilityTool } from './tools/check-availability.tool';
import { CreateAppointmentTool } from './tools/create-appointment.tool';
import { CancelAppointmentTool, RescheduleAppointmentTool } from './tools/manage-appointment.tools';
import { ProposeSlotsTool } from './tools/propose-slots.tool';
import { FindMyAppointmentsTool } from './tools/find-my-appointments.tool';
import { SendMessageTool } from './tools/send-message.tool';
import { IPatientRepository, PATIENT_REPOSITORY } from '../../domain/identity/repositories';
import { IDoctorRepository, DOCTOR_REPOSITORY } from '../../domain/identity/repositories';
import { ScheduleAppointmentUseCase } from '../scheduling/use-cases/schedule-appointment.usecase';
import { CancelAppointmentUseCase, RescheduleAppointmentUseCase } from '../scheduling/use-cases/manage-appointment.usecases';
import { CheckAvailabilityUseCase } from '../availability/use-cases/check-availability.usecase';
import { GetAppointmentUseCase } from '../scheduling/use-cases/get-appointment.usecase';
import { MetricsCollector } from '../../infrastructure/observability/metrics';
import { OutputSanitizer } from '../../shared/security/output-sanitizer';

export interface AgentMessageSender {
  send(to: string, msg: OutgoingMessage): Promise<void>;
}

export const AGENT_MESSAGE_SENDER = Symbol('AGENT_MESSAGE_SENDER');

/**
 * AgentOrchestrator - coordina el ciclo ReAct del agente:
 *   1. Carga la conversaciÃ³n.
 *   2. Loop: Planner â†’ Executor â†’ push resultado al historial.
 *   3. Cuando hay reply, lo envÃ­a al canal.
 *   4. Persiste conversaciÃ³n y mensajes.
 *
 * Usa PlannerService para prompting y ExecutorService para tool execution.
 * Usa ChannelFactory para resolver el canal.
 */
@Injectable()
export class AgentOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(AgentOrchestrator.name);
  private readonly MAX_ITERATIONS: number;

  constructor(
    @Inject(TOOL_REGISTRY) private readonly tools: ToolRegistry,
    private readonly planner: PlannerService,
    private readonly executor: ExecutorService,
    private readonly memory: ConversationMemory,
    private readonly channelFactory: ChannelFactory,
    @Inject(CONVERSATION_REPOSITORY) private readonly convRepo: IConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly msgRepo: IMessageRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: IPatientRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
    private readonly scheduleAppointment: ScheduleAppointmentUseCase,
    private readonly cancelAppointment: CancelAppointmentUseCase,
    private readonly rescheduleAppointment: RescheduleAppointmentUseCase,
    private readonly checkAvailability: CheckAvailabilityUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly fsm: ConversationFSM,
    @Inject(CLOCK) private readonly clock: IClock,
    private readonly metrics: MetricsCollector,
  ) {
    this.MAX_ITERATIONS = loadEnv().AGENT_MAX_ITERATIONS;
  }

  /**
   * Transición FSM tras cada tool exitosa.
   * Si la transición no es válida según el grafo, el estado no cambia.
   */
  private readonly TOOL_NEXT_STATE: Partial<Record<string, ConversationState>> = {
    identify_patient: 'collecting_intent',
    list_doctors: 'collecting_intent',
    check_availability: 'showing_slots',
    find_my_appointments: 'collecting_intent',
    propose_slots: 'awaiting_slot_choice',
    create_appointment: 'idle',
    cancel_appointment: 'idle',
    reschedule_appointment: 'idle',
  };

    onModuleInit(): void {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.tools.register(IdentifyPatientTool);
    this.tools.register(ListDoctorsTool);
    this.tools.register(CheckAvailabilityTool);
    this.tools.register(CreateAppointmentTool);
    this.tools.register(CancelAppointmentTool);
    this.tools.register(RescheduleAppointmentTool);
    this.tools.register(ProposeSlotsTool);
    this.tools.register(FindMyAppointmentsTool);
    this.tools.register(SendMessageTool);
  }

  /**
   * Maneja un mensaje entrante.
   */
  async handleMessage(msg: IncomingMessage): Promise<string> {
    const conversation = await this.loadOrCreateConversation(msg);
    conversation.pushMessage({ role: 'user', content: msg.text, at: this.clock.now() });
    this.metrics.messages.inc({ channel: msg.channel, state: conversation.state });

    // Empujón guiado por estado: aplica también cuando el turno llega
    // con la conversación YA avanzada (no solo tras check_availability).
    if (
      conversation.state === 'showing_slots' ||
      conversation.state === 'awaiting_slot_choice'
    ) {
      const pid = conversation.context.patientId ?? '(pendiente: identifica al paciente)';
      conversation.pushMessage({
        role: 'system',
        content:
          'Recordatorio operativo: estás en estado "' + conversation.state + '". Si el usuario ya expresó fecha/hora concretas, llama create_appointment con {patientId: ' + pid + ', doctorId elegido del contexto o vía list_doctors, date YYYY-MM-DD, time HH:MM}. No pidas datos que ya tienes.',
        at: this.clock.now(),
      });
    }

    // ── Auto-identificación por número (caller-ID) ──────────────────
    // Si el externalId es un teléfono registrado (WhatsApp u otro canal
    // que use E.164), reconocemos al paciente SIN preguntarle nada.
    if (!conversation.context.patientId && /^\+?\d{8,15}$/.test(msg.externalId)) {
      const known = await this.patientRepo.findByPhone(msg.externalId).catch(() => null);
      if (known) {
        conversation.patchContext({ patientId: known.id });
        conversation.pushMessage({
          role: 'system',
          content:
            `El usuario ya está identificado por su número ${msg.externalId}: ` +
            `patientId=${known.id}, nombre=${known.name.name}. ` +
            `NO le pidas sus datos ni llames identify_patient para identificarlo.`,
          at: this.clock.now(),
        });
        if (
          conversation.state === 'greeting' &&
          this.fsm.canTransition(conversation.state, 'collecting_intent')
        ) {
          conversation.transitionTo('collecting_intent');
        }
        this.logger.log(
          `[auto-id] ${msg.externalId} → paciente ${known.id} (${known.name.full})`,
        );
      }
    }

    // Nudge por INTENCIÓN del usuario: reagendar / cancelar.
    const quiereModificar =
      /(cambiar|reagenda|mover|modifica|otro d[ií]a|d[ií]a siguiente|cancelar)/i.test(msg.text);
    if (
      quiereModificar &&
      conversation.state !== 'closed' &&
      !['showing_slots', 'awaiting_slot_choice'].includes(conversation.state)
    ) {
      const pid = conversation.context.patientId;
      if (pid) {
        // Determinista: consultamos las citas activos NOSOTROS y las ponemos
        // en el contexto. El modelo ya no tiene excusa para no tener el ID.
        const activas = await this.getAppointment.upcomingByPatient(pid).catch(() => []);
        const resumen = activas.map((a) => ({
          appointmentId: a.id,
          fecha: a.date.value,
          hora: a.time.value,
          estado: a.status.value,
          doctorId: a.doctorId,
        }));
        conversation.pushMessage({
          role: 'system',
          content:
            'El usuario quiere MODIFICAR o CANCELAR una cita. Estas son sus citas activas (JSON): ' +
            JSON.stringify(resumen) +
            '. Con esta info: (a) si cambia fecha/hora y ya la dijo, llama check_availability {doctorId,date} y luego reschedule_appointment {appointmentId,newDate,newTime}; ' +
            '(b) si falta algún dato, pregunta SOLO lo que falte; ' +
            '(c) si cancela, cancel_appointment {appointmentId}. NUNCA digas que hiciste un cambio sin tool exitosa.',
          at: this.clock.now(),
        });
        this.logger.log(
          `[nudge] modificación: ${resumen.length} cita(s) activa(s) inyectadas al contexto`,
        );
      } else if (/^\+?\d{8,15}$/.test(msg.externalId)) {
        conversation.pushMessage({
          role: 'system',
          content:
            'El usuario quiere modificar una cita pero aún no está identificado. ' +
            'Llama identify_patient con su teléfono (' + msg.externalId + ') primero.',
          at: this.clock.now(),
        });
      }
    }

    let reply = '';
    let iteration = 0;

    // ── Ruta determinista: "mover mi cita" con destino claro ────────
    // Cuando la intención es inequívoca y el paciente tiene UNA sola cita
    // activa, ejecutamos el reschedule sin depender del LLM. Más rápido,
    // cero alucinaciones. Si falla o es ambiguo → cae al flujo ReAct normal.
    const deterministic = await this.tryDeterministicReschedule(msg, conversation);
    if (deterministic !== null) {
      reply = deterministic;
      iteration = this.MAX_ITERATIONS + 1; // salta el bucle LLM
    }

    while (iteration++ < this.MAX_ITERATIONS) {
      const decision = await this.planner.plan(conversation);

      if (decision.type === 'reply') {
        reply = decision.text ?? this.fallbackReply();
        this.recordTokens(decision.tokensUsed);
        break;
      }

      if (decision.type === 'tool_call' && decision.tool) {
        // Guardarraíl FSM: en vez de cortar, alimentamos al modelo con el
        // aviso para que se corrija usando las tools permitidas del estado.
        if (!this.fsm.canUseTool(conversation.state, decision.tool.name)) {
          const allowed = this.fsm.allowedTools(conversation.state);
          this.logger.warn(
            `Tool ${decision.tool.name} blocked by FSM in state ${conversation.state}. Allowed: ${allowed.join(',')}`,
          );
          conversation.pushMessage({
            role: 'tool',
            content:
              `fsm_guard: la tool "${decision.tool.name}" NO está permitida en el estado "${conversation.state}". ` +
              `Tools permitidas ahora: ${allowed.join(', ')}. Usa solo una de esas, o pide al usuario el dato que falte.`,
            toolName: decision.tool.name,
            at: this.clock.now(),
          });
          continue;
        }

        this.logger.log(`[react] iter=${iteration} tool=${decision.tool.name} state=${conversation.state}`);

        const execResult = await this.executor.execute(
          decision.tool.name,
          decision.tool.input,
          {
            conversationId: conversation.id,
            channel: msg.channel,
            state: conversation.state,
            patientId: conversation.context.patientId,
            deps: {
              patientRepo: this.patientRepo,
              doctorRepo: this.doctorRepo,
              checkAvailability: this.checkAvailability,
              getAppointment: this.getAppointment,
              scheduleAppointment: this.scheduleAppointment,
              cancelAppointment: this.cancelAppointment,
              rescheduleAppointment: this.rescheduleAppointment,
              messageSender: this.buildMessageSender(msg),
            },
          },
        );

        conversation.pushMessage({
          role: 'tool',
          content: execResult.ok
            ? JSON.stringify(execResult.result)
            : `error: ${execResult.error}` + (execResult.validationErrors ? ` ${JSON.stringify(execResult.validationErrors)}` : ''),
          toolName: decision.tool.name,
          toolResult: execResult.result,
          at: this.clock.now(),
        });
        conversation.patchContext({ lastToolResult: execResult.result });

        // Avance de la FSM: cada tool exitosa empuja la conversación al
        // siguiente estado (si la transición es válida según el grafo).
        if (execResult.ok) {
          // Guardar datos clave para que el modelo los tenga en contexto
          if (decision.tool.name === 'identify_patient') {
            const pid = (execResult.result as any)?.patientId;
            if (pid) conversation.patchContext({ patientId: pid });
          }

          const next = this.TOOL_NEXT_STATE[decision.tool.name];
          if (next && next !== conversation.state && this.fsm.canTransition(conversation.state, next)) {
            conversation.transitionTo(next);
            this.logger.log(`[fsm] ${decision.tool.name} ok → state=${conversation.state}`);

            // Empujón guiado: al ver slots, si el usuario ya dio fecha/hora,
            // el siguiente paso esperado es crear la cita (o proponer).
            if (next === 'showing_slots') {
              conversation.pushMessage({
                role: 'system',
                content:
                  'Slots consultados. Si el usuario YA indicó fecha y hora concretas, llama AHORA create_appointment con ese slot y el patientId del contexto. Si falta información, pregúntala.',
                at: this.clock.now(),
              });
            }
          }
        }
      }
    }

    if (!reply) reply = this.fallbackReply();

    // Output sanitization
    const sanitized = OutputSanitizer.sanitize(reply);
    if (!sanitized.ok) {
      this.logger.error(`Unsafe reply blocked: ${sanitized.reason}`);
      reply = 'Disculpa, no puedo responder a eso. Â¿Me lo reformulas?';
    } else {
      reply = sanitized.text;
    }

    conversation.pushMessage({ role: 'assistant', content: reply, at: this.clock.now() });

    // CompactaciÃ³n de memoria si excede budget
    await this.memory.maybeCompact(conversation);

    await this.convRepo.save(conversation);
    await this.msgRepo.append({
      conversationId: conversation.id,
      role: 'assistant',
      content: reply,
      tokens: this.estimateTokens(reply),
    });

    // Enviar al canal
    const channel = this.channelFactory.get(msg.channel);
    if (channel) {
      try {
        await channel.send(msg.externalId, { text: reply });
      } catch (e) {
        this.logger.error(`Channel send failed: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn(`No channel for ${msg.channel}, message not sent`);
    }

    return reply;
  }

  /** VersiÃ³n streaming. */
  async *streamMessage(msg: IncomingMessage): AsyncIterable<string> {
    const conversation = await this.loadOrCreateConversation(msg);
    conversation.pushMessage({ role: 'user', content: msg.text, at: this.clock.now() });

    for await (const token of this.planner.planStream(conversation)) {
      yield token;
    }
  }

  private async loadOrCreateConversation(msg: IncomingMessage): Promise<Conversation> {
    let conv = await this.convRepo.findByChannelExternalId(msg.channel, msg.externalId);
    if (!conv) {
      conv = Conversation.create({
        id: msg.conversationId ?? Id.new(),
        channel: msg.channel,
        externalId: msg.externalId,
      });
    }
    return conv;
  }

  private fallbackReply(): string {
    return 'Disculpa, no logro procesar tu solicitud. ¿Me lo repites?';
  }

  private refuseToolReply(): string {
    return 'Necesito un poco mass de informacion. ¿Me confirmas tu nombre y el motivo de tu cita?';
  }

  /**
   * Ruta determinista de reagendamiento.
   * Dispara cuando: intención explícita de mover + paciente con EXACTAMENTE
   * una cita activa + destino claro ("día siguiente" o fecha ISO explícita).
   * Devuelve el texto de respuesta, o null para delegar al LLM.
   */
  private async tryDeterministicReschedule(
    msg: IncomingMessage,
    conversation: Conversation,
  ): Promise<string | null> {
    try {
      const text = msg.text;
      const quiereMover = /(mover|mueve|mudar|reagenda|pasar.*cita|cambiar.*cita)/i.test(text);
      if (!quiereMover) return null;

      const pid = conversation.context.patientId;
      if (!pid) return null;

      const activas = await this.getAppointment.upcomingByPatient(pid);
      if (activas.length !== 1) return null; // 0 o varias → ambiguo → LLM

      const appt = activas[0];
      const dayAfter = /d[ií]a siguiente/i.test(text);
      const explicit = text.match(/(\d{4}-\d{2}-\d{2})(?:\s*(?:a\s*las?|@)\s*(\d{1,2}:\d{2}))?/i);

      let newDate: string | null = null;
      let newTime: string = explicit?.[2]
        ? explicit[2].padStart(5, '0')
        : appt.time.value; // "misma hora" por defecto

      if (dayAfter) {
        const d = new Date(`${appt.date.value}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        newDate = d.toISOString().slice(0, 10);
      } else if (explicit?.[1]) {
        newDate = explicit[1];
      }

      if (!newDate) return null;

      const updated = await this.rescheduleAppointment.execute({
        appointmentId: appt.id,
        newDate,
        newTime,
      });

      this.logger.log(
        `[deterministic] reschedule ${appt.id}: ${appt.date.value} ${appt.time.value} → ${updated.date.value} ${updated.time.value}`,
      );

      // Dejar rastro en la conversación para futuros turnos
      conversation.pushMessage({
        role: 'system',
        content: `Reagendamiento ejecutado determinísticamente: cita ${appt.id} ahora es ${updated.date.value} ${updated.time.value}.`,
        at: this.clock.now(),
      });
      conversation.transitionTo('idle');

      return (
        `Listo${await this.saludoPersonalizado(conversation.context.patientId)}, ` +
        `tu cita se movió de ${appt.date.value} ${appt.time.value} ` +
        `a **${updated.date.value} a las ${updated.time.value}` +
        `${updated.status.value === 'confirmed' ? '** (confirmada)' : '**'}.` +
        ` Te enviaremos un recordatorio.`
      );
    } catch (e) {
      // Conflicto de slot, fecha pasada, etc.: dejar que el LLM lo explique
      // con el error como contexto.
      conversation.pushMessage({
        role: 'system',
        content:
          `Intento directo de reagendamiento falló: ${(e as Error).message}. ` +
          'Explica al usuario el problema y ofrécele alternativas consultando check_availability.',
        at: this.clock.now(),
      });
      this.logger.warn(`[deterministic] falló → delegando al LLM: ${(e as Error).message}`);
      return null;
    }
  }

  private async saludoPersonalizado(patientId?: string): Promise<string> {
    if (!patientId) return '';
    const p = await this.patientRepo.findById(patientId).catch(() => null);
    return p ? `, ${p.name.name}` : '';
  }

  private buildMessageSender(msg: IncomingMessage): AgentMessageSender {
    const channel = this.channelFactory.get(msg.channel);
    return {
      async send(to: string, out: OutgoingMessage): Promise<void> {
        if (!channel) return;
        await channel.send(to, out);
      },
    };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private recordTokens(usage?: { input: number; output: number }): void {
    if (!usage) return;
    this.metrics.tokens.inc({ model: 'agent', direction: 'input' }, usage.input);
    this.metrics.tokens.inc({ model: 'agent', direction: 'output' }, usage.output);
  }
}
