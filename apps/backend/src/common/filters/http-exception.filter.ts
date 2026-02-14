import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.getErrorResponse(exception, request);
    const status = this.getStatusFromException(exception);

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    response.status(status).json(errorResponse);
  }

  private getStatusFromException(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorResponse(exception: unknown, request: Request) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 50001;
    let message = 'Internal server error';
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        code = (exceptionResponse as any).code || this.getCodeFromStatus(status);
        details = (exceptionResponse as any).details;
      } else {
        message = exceptionResponse as string;
        code = this.getCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    };
  }

  private getCodeFromStatus(status: number): number {
    // 将 HTTP 状态码转换为业务错误码
    // 例如：404 -> 40401, 401 -> 40101
    const statusStr = status.toString();
    return parseInt(statusStr + '01');
  }
}
