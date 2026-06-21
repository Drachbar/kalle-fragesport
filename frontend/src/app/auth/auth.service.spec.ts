import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withFetch,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthService, type AuthUser } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const admin: AuthUser = {
    id: 'id-1',
    email: 'kalle@post.se',
    role: 'admin',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        AuthService,
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('startar utloggad', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.isAdmin()).toBe(false);
  });

  it('login postar med credentials och sätter currentUser', () => {
    service.login('kalle@post.se', 'hemligt123').subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({
      email: 'kalle@post.se',
      password: 'hemligt123',
    });
    req.flush(admin);

    expect(service.currentUser()).toEqual(admin);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(true);
  });

  it('register postar till /api/auth/register', () => {
    service.register('ny@post.se', 'hemligt123').subscribe();

    const req = httpMock.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 'id-2', email: 'ny@post.se', role: 'user' });
  });

  it('loadCurrentUser sätter användaren vid 200', () => {
    service.loadCurrentUser().subscribe();

    httpMock.expectOne('/api/auth/me').flush(admin);

    expect(service.currentUser()).toEqual(admin);
  });

  it('loadCurrentUser nollställer vid 401', () => {
    service.loadCurrentUser().subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/auth/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.currentUser()).toBeNull();
  });

  it('logout nollställer currentUser', () => {
    service.login('kalle@post.se', 'hemligt123').subscribe();
    httpMock.expectOne('/api/auth/login').flush(admin);
    expect(service.isLoggedIn()).toBe(true);

    service.logout().subscribe();
    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.currentUser()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
  });
});
