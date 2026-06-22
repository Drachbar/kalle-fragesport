import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionsService, type Question } from '../questions/questions.service';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly questionsService = inject(QuestionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly current = signal<Question | null>(null);
  protected readonly showAnswer = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Frågans id ligger i url:en (/quiz/:id). Att reagera på param-ändringar gör
    // att direktlänkar och webbläsarens bakåt/framåt-knappar laddar rätt fråga.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      // Hämta bara i webbläsaren – backend finns inte vid prerender.
      if (!this.isBrowser) {
        return;
      }
      const id = params.get('id');
      if (id) {
        // Redan visad fråga (t.ex. efter en redirect från startsidan) – hoppa över.
        if (id === this.current()?.id) {
          return;
        }
        this.loadById(id);
      } else {
        this.loadRandom(true);
      }
    });
  }

  protected reveal(): void {
    this.showAnswer.set(true);
  }

  protected next(): void {
    this.loadRandom(false);
  }

  private loadRandom(replaceUrl: boolean): void {
    // Backend serverar en slumpmässig fråga (null/204 = inga frågor).
    this.showAnswer.set(false);
    this.loading.set(true);
    this.questionsService.random().subscribe({
      next: (question) => {
        this.current.set(question);
        this.loading.set(false);
        if (question) {
          // Spegla id:t i url:en. replaceUrl=true vid första laddningen (ingen
          // extra historikpost), false vid "Nästa fråga" så bakåt fungerar.
          this.router.navigate(['/quiz', question.id], { replaceUrl });
        }
      },
      error: () => {
        this.error.set('Kunde inte hämta frågor');
        this.loading.set(false);
      },
    });
  }

  private loadById(id: string): void {
    this.showAnswer.set(false);
    this.loading.set(true);
    this.questionsService.get(id).subscribe({
      next: (question) => {
        this.current.set(question);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Kunde inte hämta frågan');
        this.loading.set(false);
      },
    });
  }
}
