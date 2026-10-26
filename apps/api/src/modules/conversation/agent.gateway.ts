import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { WebSocket as WsSocket } from 'ws';
import { ProcessIncomingMessageUseCase } from './use-cases/process-incoming-message.usecase';
import { IncomingMessage } from '../../domain/communication/channel.port';

/**
 * WebSocket gateway para el agente - permite probar vÃ­a navegador
 * con streaming de tokens en tiempo real.
 */
@WebSocketGateway({})
export class AgentGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentGateway.name);
  @WebSocketServer() server!: import('ws').Server;

  constructor(private readonly processMessage: ProcessIncomingMessageUseCase) {}

  afterInit(): void {
    this.logger.log('AgentGateway initialized on /agent');
  }

  handleConnection(client: WsSocket): void {
    this.logger.log(`Client connected: ${client.url}`);
  }

  handleDisconnect(_client: WsSocket): void {
    this.logger.log(`Client disconnected`);
  }

  @SubscribeMessage('message')
  async onMessage(
    client: WsSocket,
    payload: { conversationId: string; text: string },
  ): Promise<void> {
    const msg: IncomingMessage = {
      channel: 'web',
      externalId: payload.conversationId ?? `web-${Date.now()}`,
      conversationId: payload.conversationId,
      text: payload.text,
    };

    try {
      for await (const token of this.processMessage.stream(msg)) {
        client.send(JSON.stringify({ type: 'token', content: token }));
      }
      client.send(JSON.stringify({ type: 'done' }));
    } catch (e) {
      client.send(JSON.stringify({ type: 'error', message: (e as Error).message }));
    }
  }
}
