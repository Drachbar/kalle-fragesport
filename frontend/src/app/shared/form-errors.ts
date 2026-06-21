import { AbstractControl } from '@angular/forms';

/**
 * Returnerar ett svenskt felmeddelande för en kontroll, men bara när den är
 * ogiltig och har rörts (touched). Annars null.
 */
export function controlError(
  control: AbstractControl | null | undefined,
): string | null {
  if (!control || control.valid || !control.touched) {
    return null;
  }

  const errors = control.errors ?? {};
  if (errors['required']) {
    return 'Fältet är obligatoriskt';
  }
  if (errors['email']) {
    return 'Ange en giltig e-postadress';
  }
  if (errors['minlength']) {
    return `Minst ${errors['minlength'].requiredLength} tecken`;
  }
  return 'Ogiltigt värde';
}
