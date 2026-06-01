import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        let message = 'Success';
        let resultData: unknown = data;

        if (data && typeof data === 'object') {
          const { message: msg, ...rest } = data as Record<string, unknown>;

          if (msg) {
            message = msg as string;
            resultData = Object.keys(rest).length > 0 ? rest : null;
          }
        }

        return {
          statusCode: response.statusCode,
          message,
          data: resultData as T,
        };
      }),
    );
  }
}
