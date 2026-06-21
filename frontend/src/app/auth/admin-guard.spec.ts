import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { adminGuard } from './admin-guard';
import { AuthService } from './auth.service';

function configure(isAdmin: boolean): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isAdmin: () => isAdmin } },
    ],
  });
}

describe('adminGuard', () => {
  it('släpper igenom admins', () => {
    configure(true);
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('omdirigerar icke-admins till startsidan', () => {
    configure(false);
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as never, {} as never),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });
});
