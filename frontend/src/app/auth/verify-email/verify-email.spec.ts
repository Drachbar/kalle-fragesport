import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { VerifyEmail } from './verify-email';
import { AuthService } from '../auth.service';

describe('VerifyEmail', () => {
  let auth: { verifyEmail: ReturnType<typeof vi.fn> };
  let queryParams: Record<string, string>;
  let platformId: object | string;

  beforeEach(async () => {
    queryParams = { token: 'token-123' };
    platformId = 'browser';
    auth = {
      verifyEmail: vi.fn().mockReturnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [VerifyEmail],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: PLATFORM_ID, useFactory: () => platformId },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(queryParams);
              },
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('verifierar token från query-param och visar lyckat resultat', async () => {
    const fixture = TestBed.createComponent(VerifyEmail);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.verifyEmail).toHaveBeenCalledWith('token-123');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'E-postadressen är verifierad',
    );
  });

  it('visar fel när token saknas', async () => {
    queryParams = {};

    const fixture = TestBed.createComponent(VerifyEmail);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.verifyEmail).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Verifieringslänken saknar token',
    );
  });

  it('visar fel när verifieringen misslyckas', async () => {
    auth.verifyEmail.mockReturnValue(throwError(() => new Error('invalid')));

    const fixture = TestBed.createComponent(VerifyEmail);
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Verifieringslänken är ogiltig eller har gått ut',
    );
  });

  it('anropar inte verifierings-API under serverrendering', async () => {
    platformId = 'server';

    const fixture = TestBed.createComponent(VerifyEmail);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.verifyEmail).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Verifierar e-postadressen',
    );
  });
});
