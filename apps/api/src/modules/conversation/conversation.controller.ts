import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProcessIncomingMessageUseCase } from './use-cases/process-incoming-message.usecase';
import { IncomingMessageDto } from './dto/message.dto';

@ApiTags('conversation')
@Controller('conversation')
export class ConversationController {
  constructor(private readonly processMessage: ProcessIncomingMessageUseCase) {}

  @Post('message')
  async send(@Body() dto: IncomingMessageDto): Promise<{ ok: boolean; reply: string }> {
    const reply = await this.processMessage.execute(dto);
    return { ok: true, reply };
  }
}
