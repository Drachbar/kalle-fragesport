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
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../auth.service';
import { controlError } from '../../shared/form-errors';

/** Grupp-validator: kräver att lösenordet och bekräftelsen är identiska. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

type FieldName = 'email' | 'password' | 'confirmPassword';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  /** Sant när bekräftelsen är ifylld men inte matchar lösenordet. */
  private mismatch(control: FieldName): boolean {
    return (
      control === 'confirmPassword' &&
      !!this.form.errors?.['passwordMismatch'] &&
      this.form.controls.confirmPassword.touched
    );
  }

  protected isInvalid(control: FieldName): boolean {
    const c = this.form.controls[control];
    return (c.invalid && c.touched) || this.mismatch(control);
  }

  protected errorFor(control: FieldName): string | null {
    return (
      controlError(this.form.controls[control]) ??
      (this.mismatch(control) ? 'Lösenorden matchar inte' : null)
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    // Skapa kontot och logga sedan in direkt.
    this.auth
      .register(email, password)
      .pipe(switchMap(() => this.auth.login(email, password)))
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (err: HttpErrorResponse) => {
          this.error.set(
            err.status === 409
              ? 'E-postadressen är redan registrerad'
              : 'Kunde inte skapa konto',
          );
          this.submitting.set(false);
        },
      });
  }
}
