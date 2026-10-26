import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsEmail, IsOptional, IsNumber } from 'class-validator';

export class CreateDoctorDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() lastname!: string;
  @ApiProperty() @IsInt() cedula!: number;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty() @IsString() specialtyId!: string;
  @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsNumber() dailyLimit?: number | null;
}
