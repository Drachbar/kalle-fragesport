import { HttpErrorResponse } from '@angular/common/http';

/**
 * Plockar fram serverns felmeddelande ur ett HTTP-fel. Backend svarar med
 * `{ error: string }`; finns det meddelandet används det, annars `fallback`.
 */
export function extractHttpError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: unknown } | null;
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      return body.error;
    }
  }
  return fallback;
}
