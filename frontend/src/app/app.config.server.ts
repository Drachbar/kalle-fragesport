import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL } from './shared/api-base-url';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Under SSR går API-anrop direkt till backend (ingen origin för fetch i
    // Node). Sätt BACKEND_INTERNAL_URL i prod, t.ex. http://backend:3000.
    {
      provide: API_BASE_URL,
      useValue: process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3000',
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
