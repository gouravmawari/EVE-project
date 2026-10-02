import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
@Catch()
/** Normalizes HTTP and unexpected errors into the API error response shape. */
export class HttpExceptionFilter implements ExceptionFilter {
  /** Writes status, message, timestamp, and request path to the response. */
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const response =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof response === 'object' && response && 'message' in response
        ? (response as any).message
        : typeof response === 'string'
          ? response
          : 'Internal server error';
    res.status(status).json({
      statusCode: status,
      message,
      error: status >= 500 ? 'Internal Server Error' : 'Request Error',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}
