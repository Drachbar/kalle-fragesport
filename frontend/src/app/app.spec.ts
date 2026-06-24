import { TestBed } from '@angular/core/testing';
import { signal, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthService, type AuthUser } from './auth/auth.service';

interface GoogleFcWindow {
  googlefc?: { showRevocationMessage?: () => void };
}

function consentButton(el: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(el.querySelectorAll('footer button')).find((b) =>
    b.textContent?.includes('Hantera annonssamtycke'),
  ) as HTMLButtonElement | undefined;
}

function configure(user: AuthUser | null): void {
  const u = signal(user);
  const authStub: Pick<
    AuthService,
    'currentUser' | 'isLoggedIn' | 'isAdmin'
  > = {
    currentUser: u.asReadonly(),
    isLoggedIn: signal(user !== null).asReadonly(),
    isAdmin: signal(user?.role === 'admin').asReadonly(),
  };

  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([]),
      provideHttpClient(withFetch()),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub },
    ],
  });
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('visar inloggnings- och registreringslänkar när man är utloggad', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Logga in');
    expect(compiled.textContent).toContain('Skapa konto');
  });

  it('visar inte "Frågor"-länken för utloggade', async () => {
    configure(null);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/questions"]',
    );
    expect(link).toBeNull();
  });

  it('visar inte "Frågor"-länken för icke-admins', async () => {
    configure({ id: '1', email: 'u@example.com', role: 'user' });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/questions"]',
    );
    expect(link).toBeNull();
  });

  it('visar "Frågor"-länken för admins', async () => {
    configure({ id: '1', email: 'a@example.com', role: 'admin' });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/questions"]',
    );
    expect(link).not.toBeNull();
  });

  it('har en footer med länk till integritetspolicyn', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'footer a[href="/integritetspolicy"]',
    );
    expect(link).not.toBeNull();
  });

  describe('annonssamtycke', () => {
    afterEach(() => {
      delete (window as GoogleFcWindow).googlefc;
    });

    it('har en knapp för att hantera annonssamtycke i footern', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(consentButton(fixture.nativeElement as HTMLElement)).toBeTruthy();
    });

    it('öppnar Googles samtyckesruta när man klickar på knappen', async () => {
      const showRevocationMessage = vi.fn();
      (window as GoogleFcWindow).googlefc = { showRevocationMessage };

      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      consentButton(fixture.nativeElement as HTMLElement)?.click();

      expect(showRevocationMessage).toHaveBeenCalledTimes(1);
    });

    it('kraschar inte om Googles CMP ännu inte har laddats', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const btn = consentButton(fixture.nativeElement as HTMLElement);

      expect(() => btn?.click()).not.toThrow();
    });

    it('rör inte window under server-rendering (SSR)', async () => {
      const showRevocationMessage = vi.fn();
      (window as GoogleFcWindow).googlefc = { showRevocationMessage };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [App],
        providers: [
          provideRouter([]),
          provideHttpClient(withFetch()),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      consentButton(fixture.nativeElement as HTMLElement)?.click();

      expect(showRevocationMessage).not.toHaveBeenCalled();
    });
  });
});
