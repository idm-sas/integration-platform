import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_MESSAGE } from '../constants/http-status.constant';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Ambil requestId yang sudah di-set interceptor, atau generate baru
    const requestId =
      (request as any)['requestId'] ||
      (request.headers['x-request-id'] as string) ||
      uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = ERROR_MESSAGE.INTERNAL;
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        const resObj = res as any;
        // Ambil message dari NestJS validation pipe (array) atau string
        message = Array.isArray(resObj.message)
          ? resObj.message.join(', ')
          : resObj.message || message;
        details = resObj.details || null;
      }
    } else {
      this.logger.error(
        { err: exception, path: request.url, method: request.method },
        'Unhandled exception',
      );
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      error: {
        statusCode: status,
        details,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
      requestId,
    });
  }
}