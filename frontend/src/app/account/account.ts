import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { controlError } from '../shared/form-errors';

/** Grupp-validator: kräver att de två nya lösenorden är identiska. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmNewPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmNewPassword';

@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // --- Byt lösenord -------------------------------------------------------
  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );
  protected readonly passwordSubmitting = signal(false);
  protected readonly passwordSuccess = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  private mismatch(control: PasswordField): boolean {
    return (
      control === 'confirmNewPassword' &&
      !!this.passwordForm.errors?.['passwordMismatch'] &&
      this.passwordForm.controls.confirmNewPassword.touched
    );
  }

  protected isInvalid(control: PasswordField): boolean {
    const c = this.passwordForm.controls[control];
    return (c.invalid && c.touched) || this.mismatch(control);
  }

  protected errorFor(control: PasswordField): string | null {
    return (
      controlError(this.passwordForm.controls[control]) ??
      (this.mismatch(control) ? 'Lösenorden matchar inte' : null)
    );
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordSubmitting.set(true);
    this.passwordSuccess.set(false);
    this.passwordError.set(null);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordSubmitting.set(false);
        this.passwordSuccess.set(true);
        this.passwordForm.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.passwordSubmitting.set(false);
        this.passwordError.set(
          err.status === 403
            ? 'Fel nuvarande lösenord.'
            : 'Kunde inte byta lösenord. Försök igen senare.',
        );
      },
    });
  }

  // --- Logga ut från alla enheter ----------------------------------------
  protected readonly logoutAllSubmitting = signal(false);

  protected logoutEverywhere(): void {
    this.logoutAllSubmitting.set(true);
    this.auth.logoutEverywhere().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => {
        this.logoutAllSubmitting.set(false);
      },
    });
  }

  // --- Radera konto -------------------------------------------------------
  protected readonly deleteForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
  });
  protected readonly deleteSubmitting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected deleteAccount(): void {
    if (this.deleteForm.invalid) {
      this.deleteForm.markAllAsTouched();
      return;
    }
    if (
      !confirm(
        'Är du säker på att du vill ta bort ditt konto? Detta går inte att ångra.',
      )
    ) {
      return;
    }

    this.deleteSubmitting.set(true);
    this.deleteError.set(null);

    this.auth.deleteAccount(this.deleteForm.getRawValue().password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err: HttpErrorResponse) => {
        this.deleteSubmitting.set(false);
        this.deleteError.set(
          err.status === 403
            ? 'Fel lösenord.'
            : 'Kunde inte ta bort kontot. Försök igen senare.',
        );
      },
    });
  }
}
