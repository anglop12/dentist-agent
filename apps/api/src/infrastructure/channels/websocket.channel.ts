import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelName,
  IChannel,
  IncomingMessage,
  OutgoingMessage,
} from '../../domain/communication/channel.port';

/**
 * Adapter WebSocket - envÃ­a respuestas al cliente conectado.
 * Ãštil para probar el agente desde un navegador sin WhatsApp.
 */
@Injectable()
export class WebSocketChannel implements IChannel {
  readonly name: ChannelName = 'web';
  private readonly logger = new Logger(WebSocketChannel.name);
  private handler?: (msg: IncomingMessage) => Promise<void>;
  private socket?: { send: (data: string) => void; on: (event: string, cb: (data: any) => void) => void };

  constructor() {}

  /** Vincula un socket de cliente para enviar/recibir mensajes. */
  bindSocket(socket: WebSocketChannel['socket']): void {
    this.socket = socket;
    if (this.socket && this.handler) {
      this.socket.on('message', async (data: any) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.type === 'message' && payload.text) {
            await this.handler!({
              channel: 'web',
              externalId: payload.conversationId ?? `ws-${Date.now()}`,
              conversationId: payload.conversationId,
              text: payload.text,
            });
          }
        } catch (e) {
          this.logger.error(`WS onMessage parse error: ${(e as Error).message}`);
        }
      });
    }
  }

  async start(): Promise<void> {
    this.logger.log('WebSocketChannel started');
  }

  async stop(): Promise<void> {
    this.logger.log('WebSocketChannel stopped');
  }

  async send(to: string, msg: OutgoingMessage): Promise<void> {
    if (!this.socket) {
      this.logger.warn(`No socket bound for ${to}, dropping message`);
      return;
    }
    try {
      this.socket.send(JSON.stringify({ type: 'reply', text: msg.text, to }));
    } catch (e) {
      this.logger.error(`WS send error: ${(e as Error).message}`);
    }
  }

  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void {
    this.handler = handler;
    if (this.socket) {
      this.socket.on('message', async (data: any) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.type === 'message' && payload.text) {
            await handler({
              channel: 'web',
              externalId: payload.conversationId ?? `ws-${Date.now()}`,
              conversationId: payload.conversationId,
              text: payload.text,
            });
          }
        } catch (e) {
          this.logger.error(`WS onMessage parse error: ${(e as Error).message}`);
        }
      });
    }
  }

  async isHealthy(): Promise<boolean> {
    return !!this.socket;
  }
}
