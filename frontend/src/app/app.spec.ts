import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthService, type AuthUser } from './auth/auth.service';

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
});
