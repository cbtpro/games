import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  code: number;
  message: string;
  data: null;
  path: string;
  timestamp: string;
}

/** 统一异常出口：任何未捕获错误都变成结构化 JSON，前端永远拿到同一形状 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : exception;

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : ((rawMessage as { message?: string | string[] } | undefined)?.message ?? '服务内部错误');

    const body: ErrorBody = {
      code: status,
      message: Array.isArray(message) ? message.join('; ') : String(message),
      data: null,
      path: request?.originalUrl ?? '',
      timestamp: new Date().toISOString(),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request?.method} ${request?.originalUrl}`, exception as Error);
    }

    if (response.headersSent) return;
    response.status(status).json(body);
  }
}
