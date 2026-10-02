import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { tap } from 'rxjs';
@Injectable()
/** Preserves or generates a request ID and logs completed request metadata. */
export class RequestIdInterceptor implements NestInterceptor {
  /** Adds the request ID header and records duration when handling completes. */
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const supplied = req.headers['x-request-id'];
    const id =
      typeof supplied === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        supplied,
      )
        ? supplied
        : randomUUID();
    res.setHeader('x-request-id', id);
    const started = Date.now();
    return next.handle().pipe(
      tap(() =>
        console.log(
          JSON.stringify({
            requestId: id,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - started,
          }),
        ),
      ),
    );
  }
}
