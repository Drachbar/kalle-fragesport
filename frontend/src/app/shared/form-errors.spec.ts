import { FormControl, Validators } from '@angular/forms';
import { controlError } from './form-errors';

function touched(control: FormControl): FormControl {
  control.markAsTouched();
  return control;
}

describe('controlError', () => {
  it('returnerar null för en giltig kontroll', () => {
    const c = touched(new FormControl('a@b.se', Validators.required));
    expect(controlError(c)).toBeNull();
  });

  it('returnerar null när kontrollen inte rörts', () => {
    const c = new FormControl('', Validators.required);
    expect(controlError(c)).toBeNull();
  });

  it('ger meddelande för required', () => {
    const c = touched(new FormControl('', Validators.required));
    expect(controlError(c)).toBe('Fältet är obligatoriskt');
  });

  it('ger meddelande för ogiltig e-post', () => {
    const c = touched(new FormControl('inte-epost', Validators.email));
    expect(controlError(c)).toBe('Ange en giltig e-postadress');
  });

  it('ger meddelande för minlength med rätt längd', () => {
    const c = touched(new FormControl('kort', Validators.minLength(8)));
    expect(controlError(c)).toBe('Minst 8 tecken');
  });
});
