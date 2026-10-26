import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePatientUseCase } from './use-cases/create-patient.usecase';
import { GetPatientUseCase } from './use-cases/get-patient.usecase';
import { UpdatePatientUseCase } from './use-cases/update-patient.usecase';
import { DeletePatientUseCase } from './use-cases/delete-patient.usecase';
import { CreatePatientDto, UpdatePatientNotesDto, UpdatePatientContactDto } from './dto/patient.dto';
import { Patient } from '../../domain/identity/patient.entity';

@ApiTags('patients')
@Controller('patients')
export class PatientController {
  constructor(
    private readonly createPatient: CreatePatientUseCase,
    private readonly getPatient: GetPatientUseCase,
    private readonly updatePatient: UpdatePatientUseCase,
    private readonly deletePatient: DeletePatientUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreatePatientDto): Promise<Patient> {
    return this.createPatient.execute({
      ...dto,
      birthdate: new Date(dto.birthdate),
    });
  }

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Patient[]> {
    return this.getPatient.list({ search }, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get(':id')
  async byId(@Param('id') id: string): Promise<Patient> {
    return this.getPatient.byId(id);
  }

  @Get('by-phone/:phone')
  async byPhone(@Param('phone') phone: string): Promise<Patient | null> {
    return this.getPatient.byPhone(phone);
  }

  @Get('by-wa/:waPhone')
  async byWaPhone(@Param('waPhone') waPhone: string): Promise<Patient | null> {
    return this.getPatient.byWaPhone(waPhone);
  }

  @Patch(':id/notes')
  async updateNotes(@Param('id') id: string, @Body() dto: UpdatePatientNotesDto): Promise<void> {
    return this.updatePatient.updateNotes(id, dto.notes ?? null);
  }

  @Patch(':id/contact')
  async updateContact(
    @Param('id') id: string,
    @Body() dto: UpdatePatientContactDto,
  ): Promise<void> {
    return this.updatePatient.updateContact(id, dto.email, dto.phone);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.deletePatient.execute(id);
  }
}
