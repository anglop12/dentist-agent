import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import { createSqliteConnection, DatabaseConnection } from './connection';
import { DB_TOKEN } from './database.tokens';

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: (): DatabaseConnection => {
        const env = loadEnv();
        return createSqliteConnection(env.DATABASE_URL);
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_TOKEN) private readonly connection: DatabaseConnection) {}

  async onApplicationShutdown(): Promise<void> {
    this.connection.close();
  }
}
