import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { switchMap } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import {
  QuestionsService,
  type AutoUpdateJobStatus,
  type Question,
  type QuestionType,
} from '../questions.service';
import { JobStatusService } from '../job-status.service';

@Component({
  selector: 'app-question-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './question-list.html',
  styleUrl: './question-list.css',
})
export class QuestionList {
  private readonly questionsService = inject(QuestionsService);
  private readonly jobStatusService = inject(JobStatusService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  // Reaktiv läsning av listan. .reload() hämtar om efter en borttagning.
  protected readonly questions = httpResource<Question[]>(
    () => ({ url: '/api/questions', withCredentials: true }),
    { defaultValue: [] },
  );

  protected readonly actionError = signal<string | null>(null);
  protected readonly jobStatus = signal<AutoUpdateJobStatus | null>(null);
  protected readonly updating = computed(() => {
    const status = this.jobStatus()?.status;
    return status === 'pending' || status === 'running';
  });

  private readonly typeLabels: Record<QuestionType, string> = {
    multiple_choice: 'Flerval',
    free_text: 'Fritext',
    true_false: 'Sant/falskt',
  };

  protected typeLabel(type: QuestionType): string {
    return this.typeLabels[type];
  }

  protected remove(question: Question): void {
    if (!confirm(`Ta bort frågan "${question.question}"?`)) {
      return;
    }
    this.actionError.set(null);
    this.questionsService.delete(question.id).subscribe({
      next: () => this.questions.reload(),
      error: () => this.actionError.set('Kunde inte ta bort frågan'),
    });
  }

  protected startAutoUpdate(): void {
    this.actionError.set(null);
    this.jobStatus.set({
      id: '',
      status: 'pending',
      total: 0,
      processed: 0,
      suggestionsCreated: 0,
      error: null,
    });

    this.questionsService
      .startAutoUpdate()
      .pipe(
        switchMap(({ jobId }) => this.jobStatusService.watch(jobId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => {
          this.jobStatus.set(job);
          if (job.status === 'failed') {
            this.actionError.set(job.error ?? 'AI-uppdateringen misslyckades');
          }
        },
        error: () => {
          this.jobStatus.set(null);
          this.actionError.set('Kunde inte starta AI-uppdateringen');
        },
      });
  }
}
