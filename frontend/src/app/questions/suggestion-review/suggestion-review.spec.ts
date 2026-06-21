import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { QuestionsService, type PendingSuggestion } from '../questions.service';
import { SuggestionReview } from './suggestion-review';

function suggestion(): PendingSuggestion {
  return {
    id: 's-1',
    questionId: 'q-1',
    question: 'Hur många mål har spelaren gjort?',
    previousAnswer: '7',
    suggestedAnswer: '8',
    sources: ['https://example.com/statistik'],
    reasoning: 'Den senaste matchen ökade totalen.',
    confidence: 0.92,
    status: 'pending',
    createdAt: '2026-06-22T00:00:00.000Z',
  };
}

function configure() {
  const service = {
    listSuggestions: vi.fn(() => of([suggestion()])),
    approveSuggestion: vi.fn(() => of(undefined)),
    rejectSuggestion: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    imports: [SuggestionReview],
    providers: [
      provideRouter([]),
      { provide: QuestionsService, useValue: service },
    ],
  });
  return service;
}

describe('SuggestionReview', () => {
  it('visar gammalt och föreslaget svar med källa', async () => {
    configure();
    const fixture = TestBed.createComponent(SuggestionReview);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('7');
    expect(el.textContent).toContain('8');
    expect(el.textContent).toContain('92 %');
    expect(el.querySelector('.sources a')?.getAttribute('href')).toBe(
      'https://example.com/statistik',
    );
  });

  it('godkänner förslaget och tar bort det ur listan', async () => {
    const service = configure();
    const fixture = TestBed.createComponent(SuggestionReview);
    await fixture.whenStable();
    fixture.detectChanges();

    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => candidate.textContent?.includes('Godkänn')) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.approveSuggestion).toHaveBeenCalledWith('s-1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Inga väntande förslag',
    );
  });

  it('avvisar förslaget och tar bort det ur listan', async () => {
    const service = configure();
    const fixture = TestBed.createComponent(SuggestionReview);
    await fixture.whenStable();
    fixture.detectChanges();

    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => candidate.textContent?.includes('Avvisa')) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(service.rejectSuggestion).toHaveBeenCalledWith('s-1');
  });
});
