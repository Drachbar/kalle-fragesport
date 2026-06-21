import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { AuthService } from '../../auth/auth.service';
import {
  QuestionsService,
  type Question,
  type QuestionType,
} from '../questions.service';

@Component({
  selector: 'app-question-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './question-list.html',
  styleUrl: './question-list.css',
})
export class QuestionList {
  private readonly questionsService = inject(QuestionsService);
  protected readonly auth = inject(AuthService);

  // Reaktiv läsning av listan. .reload() hämtar om efter en borttagning.
  protected readonly questions = httpResource<Question[]>(
    () => ({ url: '/api/questions', withCredentials: true }),
    { defaultValue: [] },
  );

  protected readonly actionError = signal<string | null>(null);

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
}
