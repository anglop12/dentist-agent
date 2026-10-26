import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class IncomingMessageDto {
  @ApiProperty({ enum: ['whatsapp', 'telegram', 'web', 'webhook'] })
  @IsIn(['whatsapp', 'telegram', 'web', 'webhook'])
  channel!: 'whatsapp' | 'telegram' | 'web' | 'webhook';

  @ApiProperty()
  @IsString()
  externalId!: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
