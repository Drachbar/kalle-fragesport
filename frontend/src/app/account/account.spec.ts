import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Account } from './account';
import { AuthService } from '../auth/auth.service';

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submit(el: HTMLElement, formSelector: string): void {
  (el.querySelector(formSelector) as HTMLFormElement).dispatchEvent(
    new Event('submit'),
  );
}

describe('Account', () => {
  let auth: {
    changePassword: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
    logoutEverywhere: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    auth = {
      changePassword: vi.fn().mockReturnValue(of(undefined)),
      deleteAccount: vi.fn().mockReturnValue(of(undefined)),
      logoutEverywhere: vi.fn().mockReturnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [Account],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('skapar komponenten', () => {
    expect(TestBed.createComponent(Account).componentInstance).toBeTruthy();
  });

  it('byter lösenord och visar en bekräftelse', async () => {
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#current-password', 'nuvarande123');
    setInput(el, '#new-password', 'nyttlosen456');
    setInput(el, '#confirm-new-password', 'nyttlosen456');
    submit(el, 'form.password-form');
    await fixture.whenStable();

    expect(auth.changePassword).toHaveBeenCalledWith(
      'nuvarande123',
      'nyttlosen456',
    );
    expect(el.textContent).toContain('Lösenordet har uppdaterats');
  });

  it('byter inte lösenord när de nya inte matchar', async () => {
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#current-password', 'nuvarande123');
    setInput(el, '#new-password', 'nyttlosen456');
    setInput(el, '#confirm-new-password', 'annatlosen');
    submit(el, 'form.password-form');
    await fixture.whenStable();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Lösenorden matchar inte');
  });

  it('visar fel vid felaktigt nuvarande lösenord', async () => {
    auth.changePassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#current-password', 'fel');
    setInput(el, '#new-password', 'nyttlosen456');
    setInput(el, '#confirm-new-password', 'nyttlosen456');
    submit(el, 'form.password-form');
    await fixture.whenStable();

    expect(el.textContent?.toLowerCase()).toContain('fel nuvarande lösenord');
  });

  it('raderar kontot efter bekräftelse och navigerar till startsidan', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    setInput(el, '#delete-password', 'hemligt123');
    submit(el, 'form.delete-form');
    await fixture.whenStable();

    expect(auth.deleteAccount).toHaveBeenCalledWith('hemligt123');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('raderar inte kontot om bekräftelsen avbryts', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#delete-password', 'hemligt123');
    submit(el, 'form.delete-form');
    await fixture.whenStable();

    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('loggar ut från alla enheter och navigerar till inloggningen', async () => {
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Logga ut från alla enheter'),
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(auth.logoutEverywhere).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
