import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class ApiPrefixInterceptor implements HttpInterceptor {
  // This is the base URL for your embedded NestJS server.
  private readonly apiUrl = 'http://localhost:3000';

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Check if the request URL starts with '/api'.
    if (req.url.startsWith('/api')) {
      // Clone the request and prepend the apiUrl.
      const apiReq = req.clone({
        url: `${this.apiUrl}${req.url}`,
      });
      // Pass the new, modified request to the next handler.
      console.log('API Prefix Interceptor - modified request URL:', apiReq.url);
      return next.handle(apiReq);
    }

    // If the URL does not start with '/api', pass it through unchanged.
    return next.handle(req);
  }
}