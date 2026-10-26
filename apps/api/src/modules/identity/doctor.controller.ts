import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateDoctorUseCase, GetDoctorUseCase } from './use-cases/doctor.usecases';
import { CreateDoctorDto } from './dto/doctor.dto';
import { Doctor } from '../../domain/identity/doctor.entity';

@ApiTags('doctors')
@Controller('doctors')
export class DoctorController {
  constructor(
    private readonly createDoctor: CreateDoctorUseCase,
    private readonly getDoctor: GetDoctorUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateDoctorDto): Promise<Doctor> {
    return this.createDoctor.execute(dto);
  }

  @Get()
  async list(
    @Query('specialtyId') specialtyId?: string,
    @Query('active') active?: string,
  ): Promise<Doctor[]> {
    const filter: { specialtyId?: string; active?: boolean } = {};
    if (specialtyId) filter.specialtyId = specialtyId;
    if (active !== undefined) filter.active = active === 'true';
    return this.getDoctor.list(filter);
  }

  @Get(':id')
  async byId(@Param('id') id: string): Promise<Doctor> {
    return this.getDoctor.byId(id);
  }
}
