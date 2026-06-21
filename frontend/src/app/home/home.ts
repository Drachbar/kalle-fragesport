import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { QuestionsService, type Question } from '../questions/questions.service';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly questionsService = inject(QuestionsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly current = signal<Question | null>(null);
  protected readonly showAnswer = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Hämta bara i webbläsaren – backend finns inte vid prerender.
    if (!this.isBrowser) {
      return;
    }
    this.loadNext();
  }

  protected reveal(): void {
    this.showAnswer.set(true);
  }

  protected next(): void {
    this.loadNext();
  }

  private loadNext(): void {
    // Backend serverar en slumpmässig fråga (null/204 = inga frågor).
    this.showAnswer.set(false);
    this.questionsService.random().subscribe({
      next: (question) => {
        this.current.set(question);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Kunde inte hämta frågor');
        this.loading.set(false);
      },
    });
  }
}
