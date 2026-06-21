import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Släpper bara igenom admins. Övriga skickas till startsidan.
 * (Backend skyddar ändå skrivoperationerna – det här är för UI/UX.)
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.parseUrl('/');
};
