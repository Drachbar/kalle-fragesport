import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { QuestionsService, type PendingSuggestion } from '../questions.service';
import { extractHttpError } from '../../shared/http-error';

@Component({
  selector: 'app-suggestion-review',
  imports: [RouterLink],
  templateUrl: './suggestion-review.html',
  styleUrl: './suggestion-review.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionReview {
  private readonly questionsService = inject(QuestionsService);

  protected readonly suggestions = signal<PendingSuggestion[]>([]);
  protected readonly loading = signal(true);
  protected readonly actionId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  constructor() {
    this.questionsService
      .listSuggestions()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (suggestions) => this.suggestions.set(suggestions),
        error: () => this.actionError.set('Kunde inte hämta AI-förslag'),
      });
  }

  protected confidencePercent(confidence: number | null): number | null {
    return confidence === null ? null : Math.round(confidence * 100);
  }

  protected optionsChanged(suggestion: PendingSuggestion): boolean {
    return (
      suggestion.previousOptions.length !== suggestion.suggestedOptions.length ||
      suggestion.previousOptions.some(
        (option, index) => option !== suggestion.suggestedOptions[index],
      )
    );
  }

  protected approve(id: string): void {
    this.perform(id, () => this.questionsService.approveSuggestion(id));
  }

  protected reject(id: string): void {
    this.perform(id, () => this.questionsService.rejectSuggestion(id));
  }

  private perform(id: string, request: () => ReturnType<QuestionsService['approveSuggestion']>): void {
    this.actionId.set(id);
    this.actionError.set(null);
    request()
      .pipe(finalize(() => this.actionId.set(null)))
      .subscribe({
        next: () => this.suggestions.update((items) => items.filter((item) => item.id !== id)),
        error: (err) =>
          this.actionError.set(
            extractHttpError(err, 'Kunde inte behandla förslaget'),
          ),
      });
  }
}
