import { InjectionToken, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Bas-URL som rot-relativa API-anrop (t.ex. `/api/...`) prefixas med.
 *
 * I webbläsaren är den tom – `/api/...` går via nginx till backend. Under
 * server-rendering (SSR) finns ingen origin för `fetch`, så servern måste
 * peka anropen direkt på backend (se `app.config.server.ts`).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});

/** Prefixar rot-relativa URL:er med {@link API_BASE_URL} när den är satt. */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (baseUrl && req.url.startsWith('/')) {
    return next(req.clone({ url: baseUrl + req.url }));
  }
  return next(req);
};
