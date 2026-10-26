/**
 * Puerto de canal - abstrae WhatsApp, Telegram, WebSocket, Webhook, etc.
 * Cada adapter implementa esta interface.
 */

export type ChannelName = 'whatsapp' | 'telegram' | 'web' | 'webhook';

export interface IncomingMessage {
  channel: ChannelName;
  externalId: string;     // ej: número de WhatsApp
  conversationId?: string;
  text: string;
  attachments?: Array<{ type: 'image' | 'audio' | 'document'; url: string; mimeType: string }>;
  raw?: unknown;
}

export interface OutgoingMessage {
  text: string;
  attachments?: Array<{ type: 'image' | 'audio' | 'document'; url: string; mimeType: string }>;
  replyTo?: string;
}

export interface IChannel {
  readonly name: ChannelName;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(to: string, msg: OutgoingMessage): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;
  isHealthy(): Promise<boolean>;
}

export const CHANNEL_HANDLER = Symbol('CHANNEL_HANDLER');

export type ChannelHandler = (msg: IncomingMessage) => Promise<void>;
