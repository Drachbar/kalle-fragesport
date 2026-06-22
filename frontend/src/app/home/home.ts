import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  TransferState,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionsService, type Question } from '../questions/questions.service';
import { SeoService } from '../shared/seo.service';

/** Transfer-state-nyckel för en specifik fråga (delas server↔klient). */
const questionKey = (id: string) => makeStateKey<Question>('question:' + id);

/** Id:t för den slumpfråga servern renderade på startsidan. */
const RANDOM_ID_KEY = makeStateKey<string>('home:randomId');

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
  private readonly transferState = inject(TransferState);
  private readonly seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly current = signal<Question | null>(null);
  protected readonly showAnswer = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Frågans id ligger i url:en (/quiz/:id). Att reagera på param-ändringar gör
    // att direktlänkar och webbläsarens bakåt/framåt-knappar laddar rätt fråga.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        // Redan visad fråga (t.ex. efter en redirect från startsidan) – hoppa över.
        if (id === this.current()?.id) {
          return;
        }
        // Körs även under SSR så att frågan finns i den serverrenderade HTML:en.
        this.loadById(id);
        return;
      }

      // Ingen id = startsidan (slumpfråga).
      if (!this.isBrowser) {
        // SSR: hämta + rendera en slumpfråga och spara den åt klienten.
        this.loadRandom(true);
        return;
      }

      // Klienten: om servern redan slumpade fram en fråga, spegla bara dess id
      // i url:en – den återskapade /quiz/:id återanvänder frågan utan nytt anrop.
      const ssrRandomId = this.transferState.get(RANDOM_ID_KEY, null);
      if (ssrRandomId) {
        this.transferState.remove(RANDOM_ID_KEY);
        this.router.navigate(['/quiz', ssrRandomId], { replaceUrl: true });
        return;
      }

      // Annars (ren klient-navigering till "/"): hämta en ny slumpfråga.
      this.loadRandom(true);
    });
  }

  /** Visar en fråga och uppdaterar SEO-taggarna (titel, description, canonical). */
  private show(question: Question): void {
    this.showAnswer.set(false);
    this.current.set(question);
    this.loading.set(false);
    this.seo.setQuestion(question);
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
        if (!question) {
          this.current.set(null);
          this.loading.set(false);
          return;
        }
        this.show(question);
        if (this.isBrowser) {
          // Spegla id:t i url:en. replaceUrl=true vid första laddningen (ingen
          // extra historikpost), false vid "Nästa fråga" så bakåt fungerar.
          this.router.navigate(['/quiz', question.id], { replaceUrl });
        } else {
          // SSR: spara frågan + vilket id klienten ska spegla i url:en, så att
          // klienten varken behöver hämta slumpen eller frågan på nytt.
          this.transferState.set(questionKey(question.id), question);
          this.transferState.set(RANDOM_ID_KEY, question.id);
        }
      },
      error: () => {
        this.error.set('Kunde inte hämta frågor');
        this.loading.set(false);
      },
    });
  }

  private loadById(id: string): void {
    const key = questionKey(id);

    // Frågan som hämtades under SSR följer med i transfer-staten – återanvänd
    // den i klienten så vi slipper ett identiskt extra anrop vid hydrering.
    const cached = this.transferState.get(key, null);
    if (cached) {
      this.transferState.remove(key);
      this.show(cached);
      return;
    }

    this.showAnswer.set(false);
    this.loading.set(true);
    this.questionsService.get(id).subscribe({
      next: (question) => {
        this.show(question);
        // På servern: spara åt klienten så den slipper hämta igen.
        if (!this.isBrowser) {
          this.transferState.set(key, question);
        }
      },
      error: () => {
        this.error.set('Kunde inte hämta frågan');
        this.loading.set(false);
      },
    });
  }
}
