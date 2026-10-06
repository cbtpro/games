import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponseBody<T> {
  code: number;
  message: string;
  data: T;
}

/** 统一成功响应包装：{ code, message, data } */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponseBody<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponseBody<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'ok',
        data: (data ?? null) as T,
      })),
    );
  }
}
