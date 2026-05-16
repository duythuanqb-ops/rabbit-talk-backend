import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If the data already has message/user or similar structure and we want to preserve it
        // Or we can standardise the envelope.
        let message = 'Success';
        let resultData = data;

        if (data && typeof data === 'object') {
          if (data.message && Object.keys(data).length === 1) {
            message = data.message;
            resultData = null;
          } else if (data.message && data.user) {
            message = data.message;
            resultData = { ...data };
            delete resultData.message;
          } else if (data.message) {
            message = data.message;
            delete data.message;
            resultData = data;
          }
        }

        return {
          statusCode: response.statusCode,
          message,
          data: resultData,
        };
      }),
    );
  }
}
