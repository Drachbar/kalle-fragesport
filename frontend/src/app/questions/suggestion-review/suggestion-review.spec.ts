import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { QuestionsService, type PendingSuggestion } from '../questions.service';
import { SuggestionReview } from './suggestion-review';

function suggestion(over: Partial<PendingSuggestion> = {}): PendingSuggestion {
  return {
    id: 's-1',
    questionId: 'q-1',
    question: 'Hur många mål har spelaren gjort?',
    previousAnswer: '7',
    suggestedAnswer: '8',
    previousOptions: ['7', '6', '5'],
    suggestedOptions: ['8', '7', '6'],
    sources: [
      { url: 'https://example.com/statistik', publishedAt: '2026-03-01' },
    ],
    reasoning: 'Den senaste matchen ökade totalen.',
    confidence: 0.92,
    suggestedIntervalDays: 14,
    suggestedEarliestUpdateAt: '2026-09-01',
    answerAsOf: '2026-03-01',
    olderThanCurrent: false,
    status: 'pending',
    createdAt: '2026-06-22T00:00:00.000Z',
    ...over,
  };
}

// Makrotask-tick: låt httpResource skicka sin förfrågan och applicera svaret.
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

function configure() {
  const service = {
    approveSuggestion: vi.fn(() => of(undefined)),
    rejectSuggestion: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    imports: [SuggestionReview],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: QuestionsService, useValue: service },
    ],
  });
  return { service, http: TestBed.inject(HttpTestingController) };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

/** Skapar komponenten och svarar på den första list-hämtningen. */
async function setup(
  http: HttpTestingController,
  suggestions: PendingSuggestion[],
) {
  const fixture = TestBed.createComponent(SuggestionReview);
  fixture.detectChanges();
  await tick();
  http.expectOne('/api/questions/suggestions').flush(suggestions);
  await tick();
  fixture.detectChanges();
  return fixture;
}

describe('SuggestionReview', () => {
  it('visar gammalt och föreslaget svar med källa', async () => {
    const { http } = configure();
    const fixture = await setup(http, [suggestion()]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('7');
    expect(el.textContent).toContain('8');
    expect(el.textContent).toContain('92 %');
    expect(el.textContent).toContain('Tidigare alternativ');
    expect(el.textContent).toContain('Nya alternativ');
    expect(el.querySelector('.sources a')?.getAttribute('href')).toBe(
      'https://example.com/statistik',
    );
    // Källans publiceringsdatum visas.
    expect(el.querySelector('.sources a')?.textContent).toContain('2026-03-01');
  });

  it('flaggar förslag vars källa är äldre än nuvarande svar', async () => {
    const { http } = configure();
    const fixture = await setup(http, [
      suggestion({ olderThanCurrent: true }),
    ]);

    const el = fixture.nativeElement as HTMLElement;
    const warning = el.querySelector('.warning');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain('äldre än nuvarande svar');
  });

  it('visar ingen varning när källan inte är äldre', async () => {
    const { http } = configure();
    const fixture = await setup(http, [suggestion()]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.warning'),
    ).toBeNull();
  });

  it('visar felmeddelande när hämtningen misslyckas', async () => {
    const { http } = configure();
    const fixture = TestBed.createComponent(SuggestionReview);
    fixture.detectChanges();
    await tick();
    http
      .expectOne('/api/questions/suggestions')
      .flush('fel', { status: 500, statusText: 'Server Error' });
    await tick();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Kunde inte hämta AI-förslag',
    );
  });

  it('godkänner förslaget och laddar om listan', async () => {
    const { service, http } = configure();
    const fixture = await setup(http, [suggestion()]);

    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) =>
      candidate.textContent?.includes('Godkänn'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    await tick();

    expect(service.approveSuggestion).toHaveBeenCalledWith('s-1');
    // .reload() utlöser en ny hämtning – nu tom.
    http.expectOne('/api/questions/suggestions').flush([]);
    await tick();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Inga väntande förslag',
    );
  });

  it('avvisar förslaget och laddar om listan', async () => {
    const { service, http } = configure();
    const fixture = await setup(http, [suggestion()]);

    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) =>
      candidate.textContent?.includes('Avvisa'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    await tick();

    expect(service.rejectSuggestion).toHaveBeenCalledWith('s-1');
    http.expectOne('/api/questions/suggestions').flush([]);
    await tick();
  });
});
