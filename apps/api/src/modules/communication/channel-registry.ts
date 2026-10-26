/**
 * Registry de canales activos - permite al ConversationController
 * resolver un canal por nombre (whatsapp, telegram, web, webhook).
 */

import { IChannel } from '../../domain/communication/channel.port';

export const CHANNEL_REGISTRY = Symbol('CHANNEL_REGISTRY');

export type ChannelRegistry = Map<string, IChannel>;
