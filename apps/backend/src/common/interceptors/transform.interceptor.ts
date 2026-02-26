import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  code: number;
  message: string;
  data: T;
}

/** 已包含 code/message/data 的返回值不再二次包装，避免登录等接口被包两层导致前端取不到 access_token */
function isAlreadyWrapped(data: unknown): data is Response<unknown> {
  return (
    data != null &&
    typeof data === 'object' &&
    'code' in data &&
    'message' in data &&
    'data' in data
  );
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) =>
        isAlreadyWrapped(data) ? (data as Response<T>) : { code: 0, message: '成功', data },
      ),
    );
  }
}
