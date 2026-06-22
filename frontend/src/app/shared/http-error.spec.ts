import { HttpErrorResponse } from '@angular/common/http';
import { extractHttpError } from './http-error';

describe('extractHttpError', () => {
  it('returnerar serverns error-meddelande när det finns', () => {
    const err = new HttpErrorResponse({
      status: 503,
      error: { error: 'Ingen OpenAI-nyckel konfigurerad' },
    });
    expect(extractHttpError(err, 'reserv')).toBe(
      'Ingen OpenAI-nyckel konfigurerad',
    );
  });

  it('faller tillbaka när body saknar error-fält', () => {
    const err = new HttpErrorResponse({ status: 500, error: {} });
    expect(extractHttpError(err, 'reserv')).toBe('reserv');
  });

  it('faller tillbaka när body inte är ett objekt (t.ex. nätverksfel)', () => {
    const err = new HttpErrorResponse({ status: 0, error: 'nät nere' });
    expect(extractHttpError(err, 'reserv')).toBe('reserv');
  });

  it('faller tillbaka för icke-HTTP-fel', () => {
    expect(extractHttpError(new Error('oops'), 'reserv')).toBe('reserv');
  });
});
