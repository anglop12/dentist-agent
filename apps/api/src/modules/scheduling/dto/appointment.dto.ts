import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  Matches,
} from 'class-validator';

export class ScheduleAppointmentDto {
  @ApiProperty() @IsString() patientId!: string;
  @ApiProperty() @IsString() doctorId!: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time!: string;
  @ApiProperty({ enum: ['web', 'whatsapp', 'agent', 'phone', 'in_person'] })
  @IsIn(['web', 'whatsapp', 'agent', 'phone', 'in_person'])
  source!: 'web' | 'whatsapp' | 'agent' | 'phone' | 'in_person';
  @ApiProperty({ required: false }) @IsOptional() @IsString() conversationId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class CancelAppointmentDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() reason?: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) newDate!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) newTime!: string;
}

export class ChangeStatusDto {
  @ApiProperty({
    enum: ['pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled', 'expired'],
  })
  @IsIn(['pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled', 'expired'])
  status!: string;
}
