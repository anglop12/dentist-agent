import { Global, Module, Inject } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { loadEnv, Env } from './env';

export const ENV_TOKEN = Symbol('ENV_TOKEN');

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadEnv(),
    }),
  ],
  providers: [
    {
      provide: ENV_TOKEN,
      useFactory: () => loadEnv(),
    },
  ],
  exports: [ENV_TOKEN, NestConfigModule],
})
export class AppConfigModule {}

export function InjectEnv(): ParameterDecorator {
  return Inject(ENV_TOKEN);
}
