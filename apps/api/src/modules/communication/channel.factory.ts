import { Inject, Injectable, Logger } from '@nestjs/common';
import { IChannel } from '../../domain/communication/channel.port';
import { CHANNEL_REGISTRY, ChannelRegistry } from './channel-registry';

/**
 * ChannelFactory - resuelve un canal por nombre.
 * Permite al Orchestrator obtener el canal correcto para responder
 * sin acoplarse a un adapter especÃ­fico.
 */
@Injectable()
export class ChannelFactory {
  private readonly logger = new Logger(ChannelFactory.name);

  constructor(@Inject(CHANNEL_REGISTRY) private readonly registry: ChannelRegistry) {}

  get(name: string): IChannel | null {
    const channel = this.registry.get(name);
    if (!channel) {
      this.logger.warn(`Channel ${name} not registered`);
    }
    return channel ?? null;
  }

  list(): string[] {
    return [...this.registry.keys()];
  }

  /** Resuelve el canal a partir de una conversaciÃ³n existente. */
  forConversation(channelName: string): IChannel | null {
    return this.get(channelName);
  }
}
