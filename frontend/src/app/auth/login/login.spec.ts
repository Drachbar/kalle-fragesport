import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Login } from './login';
import { AuthService } from '../auth.service';

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('Login', () => {
  let auth: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = {
      login: vi
        .fn()
        .mockReturnValue(of({ id: '1', email: 'kalle@post.se', role: 'user' })),
    };
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('skapar komponenten', () => {
    expect(TestBed.createComponent(Login).componentInstance).toBeTruthy();
  });

  it('anropar inte login vid tomt formulär', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );

    expect(auth.login).not.toHaveBeenCalled();
  });

  it('visar valideringsfel vid tomt formulär', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(el.textContent).toContain('Fältet är obligatoriskt');
  });

  it('loggar in och navigerar vid giltigt formulär', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    setInput(el, '#login-email', 'kalle@post.se');
    setInput(el, '#login-password', 'hemligt123');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(auth.login).toHaveBeenCalledWith('kalle@post.se', 'hemligt123');
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
