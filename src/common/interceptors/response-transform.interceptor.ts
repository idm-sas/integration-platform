import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { SUCCESS_MESSAGE } from '../constants/http-status.constant';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Ambil dari header kalau ada, kalau tidak generate baru
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    // Simpan ke request agar bisa diakses di filter & middleware
    request['requestId'] = requestId;

    return next.handle().pipe(
      map((data) => {
        // Sudah berbentuk standard response, tambah requestId & timestamp saja
        if (data && typeof data === 'object' && 'success' in data) {
          return {
            ...data,
            timestamp: new Date().toISOString(),
            requestId,
          };
        }

        const message = data?.message || SUCCESS_MESSAGE.FETCH;
        const body = data?.data ?? data;
        const meta = data?.meta;

        return {
          success: true,
          message,
          data: body,
          ...(meta && { meta }),
          timestamp: new Date().toISOString(),
          requestId,
        };
      }),
    );
  }
}