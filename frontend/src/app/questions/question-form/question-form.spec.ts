import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { QuestionForm } from './question-form';
import { QuestionsService, type Question } from '../questions.service';

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    question: 'Sveriges huvudstad?',
    answer: 'Stockholm',
    options: ['Stockholm', 'Oslo'],
    category: 'Geografi',
    type: 'multiple_choice',
    autoUpdate: false,
    updateIntervalDays: 30,
    lastCheckedAt: null,
    earliestUpdateAt: null,
    answerAsOf: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function configure(id: string | null) {
  const service = {
    get: vi.fn(() => of(makeQuestion())),
    create: vi.fn(() => of(makeQuestion())),
    update: vi.fn(() => of(makeQuestion())),
  };
  TestBed.configureTestingModule({
    imports: [QuestionForm],
    providers: [
      provideRouter([]),
      { provide: QuestionsService, useValue: service },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => id } } },
      },
    ],
  });
  return service;
}

function setValue(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('QuestionForm (skapa)', () => {
  it('skapar en fråga och navigerar till listan', async () => {
    const service = configure(null);
    const fixture = TestBed.createComponent(QuestionForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);

    setValue(el, '#q-question', 'Vad är 2+2?');
    setValue(el, '#q-answer', '4');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(service.create).toHaveBeenCalledWith({
      question: 'Vad är 2+2?',
      answer: '4',
      type: 'multiple_choice',
      category: null,
      options: [],
      autoUpdate: false,
      updateIntervalDays: 30,
      earliestUpdateAt: null,
      answerAsOf: null,
    });
    expect(navigate).toHaveBeenCalledWith('/questions');
  });

  it('skickar autoUpdate=true när tidskänslig-rutan är ikryssad', async () => {
    const service = configure(null);
    const fixture = TestBed.createComponent(QuestionForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    setValue(el, '#q-question', 'Hur många mål i VM?');
    setValue(el, '#q-answer', '7');
    const checkbox = el.querySelector('#q-auto-update') as HTMLInputElement;
    checkbox.click();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ autoUpdate: true }),
    );
  });

  it('visar och skickar kontrollintervall när tidskänslig är ikryssad', async () => {
    const service = configure(null);
    const fixture = TestBed.createComponent(QuestionForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    // Fältet visas inte förrän rutan är ikryssad.
    expect(el.querySelector('#q-update-interval')).toBeNull();

    setValue(el, '#q-question', 'Vem är statsminister?');
    setValue(el, '#q-answer', 'NN');
    (el.querySelector('#q-auto-update') as HTMLInputElement).click();
    await fixture.whenStable();

    expect(el.querySelector('#q-update-interval')).not.toBeNull();
    setValue(el, '#q-update-interval', '7');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ autoUpdate: true, updateIntervalDays: 7 }),
    );
  });

  it('skickar answerAsOf som ifyllt datum', async () => {
    const service = configure(null);
    const fixture = TestBed.createComponent(QuestionForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    setValue(el, '#q-question', 'Vem vann?');
    setValue(el, '#q-answer', 'Kanada');
    setValue(el, '#q-answer-as-of', '2026-02-22');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ answerAsOf: '2026-02-22' }),
    );
  });

  it('lägger till och fyller i ett svarsalternativ', async () => {
    const service = configure(null);
    const fixture = TestBed.createComponent(QuestionForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const addBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Lägg till alternativ'),
    ) as HTMLButtonElement;
    addBtn.click();
    await fixture.whenStable();

    setValue(el, '#q-question', 'Fråga?');
    setValue(el, '#q-answer', 'Svar');
    setValue(el, '#q-option-0', 'Alternativ A');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ options: ['Alternativ A'] }),
    );
  });
});

describe('QuestionForm (redigera)', () => {
  it('laddar och fyller i den befintliga frågan', async () => {
    const service = configure('q-1');
    const fixture = TestBed.createComponent(QuestionForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(service.get).toHaveBeenCalledWith('q-1');
    expect((el.querySelector('#q-question') as HTMLTextAreaElement).value).toBe(
      'Sveriges huvudstad?',
    );
    expect((el.querySelector('#q-answer') as HTMLInputElement).value).toBe(
      'Stockholm',
    );
    expect(el.querySelectorAll('.option-row')).toHaveLength(2);
  });
});
