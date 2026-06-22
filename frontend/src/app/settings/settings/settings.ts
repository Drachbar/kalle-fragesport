import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import {
  SettingsService,
  type OpenAiKeyStatus,
} from '../settings.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly settingsService = inject(SettingsService);

  protected readonly status = signal<OpenAiKeyStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected readonly form = new FormGroup({
    apiKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^sk-.+/)],
    }),
  });

  constructor() {
    this.settingsService
      .getOpenAiKeyStatus()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (status) => this.status.set(status),
        error: () => this.error.set('Kunde inte hämta inställningar'),
      });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    const apiKey = this.form.controls.apiKey.value;

    this.settingsService
      .saveOpenAiKey(apiKey)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.status.update((current) =>
            current ? { ...current, userKeySet: true } : current,
          );
          this.form.reset();
          this.saved.set(true);
        },
        error: () => this.error.set('Kunde inte spara nyckeln'),
      });
  }

  protected remove(): void {
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);

    this.settingsService
      .deleteOpenAiKey()
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () =>
          this.status.update((current) =>
            current ? { ...current, userKeySet: false } : current,
          ),
        error: () => this.error.set('Kunde inte ta bort nyckeln'),
      });
  }
}
