import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../api/src/infrastructure/database/database.module';
import { JobsModule } from '../../api/src/modules/communication/jobs.module';
import { IdentityModule } from '../../api/src/modules/identity/identity.module';
import { SchedulingModule } from '../../api/src/modules/scheduling/scheduling.module';
import { ConversationModule } from '../../api/src/modules/conversation/conversation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    IdentityModule,
    SchedulingModule,
    ConversationModule,
    JobsModule,
  ],
})
export class WorkerModule {}
