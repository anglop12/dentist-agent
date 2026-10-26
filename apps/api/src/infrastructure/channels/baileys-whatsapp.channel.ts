import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelName,
  IChannel,
  IncomingMessage,
  OutgoingMessage,
} from '../../domain/communication/channel.port';

/**
 * STUB - WhatsApp adapter (Baileys).
 *
 * Para activarlo:
 *   1. pnpm add @whiskeysockets/baileys --filter @dentist/api
 *   2. Implementa makeWASocket en start() y mapea messages.upsert -> handler.
 *   3. Configura WA_ENABLED=true en .env.
 *
 * Mientras Baileys no esté instalado, este adapter es un no-op seguro.
 */
@Injectable()
export class BaileysWhatsAppChannel implements IChannel {
  readonly name: ChannelName = 'whatsapp';
  private readonly logger = new Logger(BaileysWhatsAppChannel.name);
  private connected = false;
  private messageHandler?: (msg: IncomingMessage) => Promise<void>;

  constructor() {}

  async start(): Promise<void> {
    this.logger.warn(
      'WhatsApp channel en modo STUB (Baileys no instalado). Los mensajes se descartan.',
    );
  }

  async stop(): Promise<void> {
    this.connected = false;
  }

  async send(_to: string, _msg: OutgoingMessage): Promise<void> {
    if (!this.connected) {
      this.logger.warn('WhatsApp stub: mensaje no enviado (adapter inactivo)');
    }
  }

  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async isHealthy(): Promise<boolean> {
    return this.connected;
  }
}
