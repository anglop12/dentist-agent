import { Body, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckAvailabilityUseCase } from './use-cases/check-availability.usecase';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly check: CheckAvailabilityUseCase) {}

  @Get()
  async slots(
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
  ): Promise<Awaited<ReturnType<CheckAvailabilityUseCase['execute']>>> {
    return this.check.execute({ doctorId, date });
  }
}
