import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsEmail,
  IsOptional,
  Min,
  Max,
  IsIn,
  IsDateString,
} from 'class-validator';

export class CreatePatientDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() lastname!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(150) age!: number;
  @ApiProperty() @IsInt() @Min(1) cedula!: number;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() waPhone?: string;
  @ApiProperty() @IsDateString() birthdate!: string;
  @ApiProperty() @IsString() address!: string;
  @ApiProperty({ enum: [0, 1] }) @IsIn([0, 1]) gender!: 0 | 1;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class UpdatePatientNotesDto {
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() notes?: string | null;
}

export class UpdatePatientContactDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() phone!: string;
}
