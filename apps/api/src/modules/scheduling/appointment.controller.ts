import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScheduleAppointmentUseCase } from './use-cases/schedule-appointment.usecase';
import {
  CancelAppointmentUseCase,
  RescheduleAppointmentUseCase,
} from './use-cases/manage-appointment.usecases';
import { GetAppointmentUseCase } from './use-cases/get-appointment.usecase';
import { ChangeAppointmentStatusUseCase } from './use-cases/change-status.usecase';
import {
  ScheduleAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  ChangeStatusDto,
} from './dto/appointment.dto';
import { MedicalAppointment } from '../../domain/scheduling/appointment.entity';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(
    private readonly schedule: ScheduleAppointmentUseCase,
    private readonly cancel: CancelAppointmentUseCase,
    private readonly reschedule: RescheduleAppointmentUseCase,
    private readonly get: GetAppointmentUseCase,
    private readonly changeStatus: ChangeAppointmentStatusUseCase,
  ) {}

  @Post()
  async create(@Body() dto: ScheduleAppointmentDto): Promise<MedicalAppointment> {
    return this.schedule.execute(dto);
  }

  @Get()
  async list(
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<MedicalAppointment[]> {
    const filter: any = {};
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    if (status) filter.status = status;
    if (from) filter.from = from;
    if (to) filter.to = to;
    return this.get.list(filter, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get(':id')
  async byId(@Param('id') id: string): Promise<MedicalAppointment | null> {
    return this.get.byId(id);
  }

  @Patch(':id/cancel')
  async cancelAppt(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
  ): Promise<MedicalAppointment> {
    return this.cancel.execute({ appointmentId: id, reason: dto.reason });
  }

  @Patch(':id/reschedule')
  async rescheduleAppt(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<MedicalAppointment> {
    return this.reschedule.execute({ appointmentId: id, ...dto });
  }

  @Patch(':id/status')
  async changeStatusAppt(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<MedicalAppointment> {
    return this.changeStatus.execute(id, dto.status);
  }
}
