import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const SendMessageInputSchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1).max(4096),
});

export const SendMessageTool: Tool<typeof SendMessageInputSchema> = {
  name: 'send_message',
  description: 'EnvÃ­a un mensaje al paciente por el canal configurado (WhatsApp por defecto).',
  inputSchema: SendMessageInputSchema,
  requiredPermissions: ['write:channel'],
  async execute(input: any, ctx: any) {
    const sender = ctx.deps.messageSender;
    if (!sender) throw new Error('messageSender not injected');
    await sender.send(input.to, { text: input.text });
    return { sent: true, to: input.to };
  },
};
