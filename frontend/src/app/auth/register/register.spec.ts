import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Register } from './register';
import { AuthService } from '../auth.service';

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('Register', () => {
  let auth: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const user = { id: '1', email: 'ny@post.se', role: 'user' };
    auth = {
      register: vi.fn().mockReturnValue(of(user)),
      login: vi.fn().mockReturnValue(of(user)),
    };
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('skapar komponenten', () => {
    expect(TestBed.createComponent(Register).componentInstance).toBeTruthy();
  });

  it('registrerar och visar att verifieringsmejl har skickats', async () => {
    const fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    setInput(el, '#register-email', 'ny@post.se');
    setInput(el, '#register-password', 'hemligt123');
    setInput(el, '#register-confirm-password', 'hemligt123');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(auth.register).toHaveBeenCalledWith('ny@post.se', 'hemligt123');
    expect(auth.login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Vi har skickat ett verifieringsmejl');
  });

  it('blockerar när lösenorden inte matchar', async () => {
    const fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#register-email', 'ny@post.se');
    setInput(el, '#register-password', 'hemligt123');
    setInput(el, '#register-confirm-password', 'annatlosen');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(auth.register).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Lösenorden matchar inte');
  });

  it('blockerar för kort lösenord', async () => {
    const fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#register-email', 'ny@post.se');
    setInput(el, '#register-password', 'kort');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );

    expect(auth.register).not.toHaveBeenCalled();
  });
});
