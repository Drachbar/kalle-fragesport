import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { QuestionsService, type PendingSuggestion } from '../questions.service';
import { extractHttpError } from '../../shared/http-error';

@Component({
  selector: 'app-suggestion-review',
  imports: [RouterLink, DatePipe],
  templateUrl: './suggestion-review.html',
  styleUrl: './suggestion-review.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionReview {
  private readonly questionsService = inject(QuestionsService);

  // Deklarativ läsning av förslagen. .reload() hämtar om efter godkänn/avvisa.
  protected readonly suggestions = httpResource<PendingSuggestion[]>(
    () => ({ url: '/api/questions/suggestions', withCredentials: true }),
    { defaultValue: [] },
  );

  protected readonly actionId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

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
        next: () => this.suggestions.reload(),
        error: (err) =>
          this.actionError.set(
            extractHttpError(err, 'Kunde inte behandla förslaget'),
          ),
      });
  }
}
