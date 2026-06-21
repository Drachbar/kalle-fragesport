import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
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
export class QuestionList implements OnInit {
  private readonly questionsService = inject(QuestionsService);
  protected readonly auth = inject(AuthService);

  protected readonly questions = signal<Question[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly typeLabels: Record<QuestionType, string> = {
    multiple_choice: 'Flerval',
    free_text: 'Fritext',
    true_false: 'Sant/falskt',
  };

  ngOnInit(): void {
    this.load();
  }

  protected typeLabel(type: QuestionType): string {
    return this.typeLabels[type];
  }

  protected remove(question: Question): void {
    if (!confirm(`Ta bort frågan "${question.question}"?`)) {
      return;
    }
    this.questionsService.delete(question.id).subscribe({
      next: () =>
        this.questions.update((list) =>
          list.filter((q) => q.id !== question.id),
        ),
      error: () => this.error.set('Kunde inte ta bort frågan'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.questionsService.list().subscribe({
      next: (questions) => {
        this.questions.set(questions);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Kunde inte hämta frågor');
        this.loading.set(false);
      },
    });
  }
}
