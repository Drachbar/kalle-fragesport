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
import { extractHttpError } from '../../shared/http-error';
import {
  QuestionsService,
  type AutoUpdateJobStatus,
  type Question,
  type QuestionType,
} from '../questions.service';
import { JobStatusService } from '../job-status.service';

type SortKey =
  | 'created-desc'
  | 'created-asc'
  | 'updated-desc'
  | 'updated-asc'
  | 'autoupdate-first'
  | 'autoupdate-last'
  | 'category-asc'
  | 'question-asc';

interface SortOption {
  value: SortKey;
  label: string;
}

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

  protected readonly sortOptions: readonly SortOption[] = [
    { value: 'created-desc', label: 'Senast skapad' },
    { value: 'created-asc', label: 'Äldst skapad' },
    { value: 'updated-desc', label: 'Senast uppdaterad' },
    { value: 'updated-asc', label: 'Äldst uppdaterad' },
    { value: 'autoupdate-first', label: 'Auto-uppdatering först' },
    { value: 'autoupdate-last', label: 'Auto-uppdatering sist' },
    { value: 'category-asc', label: 'Kategori (A–Ö)' },
    { value: 'question-asc', label: 'Fråga (A–Ö)' },
  ];

  protected readonly sortKey = signal<SortKey>('created-desc');

  // Sekundär ordning så att lika värden (t.ex. samma auto_update) blir stabila.
  private readonly byNewest = (a: Question, b: Question): number =>
    b.createdAt.localeCompare(a.createdAt);

  private readonly comparators: Record<
    SortKey,
    (a: Question, b: Question) => number
  > = {
    'created-desc': this.byNewest,
    'created-asc': (a, b) => a.createdAt.localeCompare(b.createdAt),
    'updated-desc': (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    'updated-asc': (a, b) => a.updatedAt.localeCompare(b.updatedAt),
    'autoupdate-first': (a, b) =>
      Number(b.autoUpdate) - Number(a.autoUpdate) || this.byNewest(a, b),
    'autoupdate-last': (a, b) =>
      Number(a.autoUpdate) - Number(b.autoUpdate) || this.byNewest(a, b),
    'category-asc': (a, b) =>
      (a.category ?? '').localeCompare(b.category ?? '', 'sv') ||
      this.byNewest(a, b),
    'question-asc': (a, b) =>
      a.question.localeCompare(b.question, 'sv') || this.byNewest(a, b),
  };

  protected readonly sortedQuestions = computed(() =>
    [...this.questions.value()].sort(this.comparators[this.sortKey()]),
  );

  protected setSort(value: string): void {
    this.sortKey.set(value as SortKey);
  }

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
      error: (err) =>
        this.actionError.set(extractHttpError(err, 'Kunde inte ta bort frågan')),
    });
  }

  protected startAutoUpdate(questionId?: string): void {
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
      .startAutoUpdate(questionId)
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
        error: (err) => {
          this.jobStatus.set(null);
          this.actionError.set(
            extractHttpError(err, 'Kunde inte starta AI-uppdateringen'),
          );
        },
      });
  }
}
