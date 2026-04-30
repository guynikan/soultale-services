import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, T> {
  intercept(_: ExecutionContext, next: CallHandler): Observable<T> {
    return next.handle().pipe(map((data) => data));
  }
}
