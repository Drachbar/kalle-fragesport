import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type Role = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

interface Credentials {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly user = signal<AuthUser | null>(null);

  /** Inloggad användare, eller null. */
  readonly currentUser = this.user.asReadonly();
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  /** Skapar ett nytt konto (roll 'user'). Loggar inte in automatiskt. */
  register(email: string, password: string): Observable<AuthUser> {
    return this.http.post<AuthUser>(
      '/api/auth/register',
      { email, password } satisfies Credentials,
      { withCredentials: true },
    );
  }

  /** Loggar in och sparar användaren i state. */
  login(email: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(
        '/api/auth/login',
        { email, password } satisfies Credentials,
        { withCredentials: true },
      )
      .pipe(tap((user) => this.user.set(user)));
  }

  /** Loggar ut och nollställer state. */
  logout(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout', null, { withCredentials: true })
      .pipe(tap(() => this.user.set(null)));
  }

  /** Loggar ut från alla enheter (avslutar alla sessioner) och nollställer state. */
  logoutEverywhere(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout-all', null, { withCredentials: true })
      .pipe(tap(() => this.user.set(null)));
  }

  /** Byter lösenord. Kräver att nuvarande lösenord stämmer (verifieras i backend). */
  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<void> {
    return this.http.put<void>(
      '/api/auth/me/password',
      { currentPassword, newPassword },
      { withCredentials: true },
    );
  }

  /** Raderar kontot (kräver lösenord) och nollställer state. */
  deleteAccount(password: string): Observable<void> {
    return this.http
      .delete<void>('/api/auth/me', {
        body: { password },
        withCredentials: true,
      })
      .pipe(tap(() => this.user.set(null)));
  }

  /** Hämtar aktuell användare via cookien; nollställer state vid fel. */
  loadCurrentUser(): Observable<AuthUser> {
    return this.http
      .get<AuthUser>('/api/auth/me', { withCredentials: true })
      .pipe(
        tap({
          next: (user) => this.user.set(user),
          error: () => this.user.set(null),
        }),
      );
  }
}
