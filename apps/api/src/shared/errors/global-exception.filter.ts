import { DomainError } from '../errors/domain.errors';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let body: Record<string, unknown>;

    if (exception instanceof DomainError) {
      status = exception.statusCode;
      body = {
        statusCode: status,
        code: exception.code,
        message: exception.message,
        ...(exception instanceof Error && 'issues' in exception
          ? { issues: (exception as any).issues }
          : {}),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body =
        typeof resp === 'string'
          ? { statusCode: status, message: resp }
          : { statusCode: status, ...(resp as object) };
    } else if (exception instanceof Error) {
      status = 500;
      body = { statusCode: status, message: 'Internal server error' };
      this.logger.error(exception.stack);
    } else {
      status = 500;
      body = { statusCode: status, message: 'Unknown error' };
    }

    body.path = request.url;
    body.timestamp = new Date().toISOString();

    response.status(status).json(body);
  }
}
