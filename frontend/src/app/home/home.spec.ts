import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Home } from './home';
import { QuestionsService, type Question } from '../questions/questions.service';

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    question: 'Sveriges huvudstad?',
    answer: 'Stockholm',
    options: ['Stockholm', 'Oslo'],
    category: 'Geografi',
    type: 'multiple_choice',
    autoUpdate: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function configure(options: {
  initialId?: string | null;
  random?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
  platform?: 'browser' | 'server';
}) {
  const paramMap$ = new BehaviorSubject(
    convertToParamMap(options.initialId ? { id: options.initialId } : {}),
  );
  const navigate = vi.fn(() => Promise.resolve(true));
  const random = options.random ?? vi.fn(() => of(makeQuestion()));
  const get = options.get ?? vi.fn((id: string) => of(makeQuestion({ id })));

  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      { provide: QuestionsService, useValue: { random, get } },
      { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
      { provide: Router, useValue: { navigate } },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
    ],
  });

  return { paramMap$, navigate, random, get };
}

describe('Home', () => {
  it('hämtar en slumpmässig fråga utan inloggning', async () => {
    configure({});
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sveriges huvudstad?');
    expect(el.textContent).not.toContain('Rätt svar:');
  });

  it('speglar den slumpade frågans id i url:en (ersätter historiken)', async () => {
    const { navigate } = configure({
      random: vi.fn(() => of(makeQuestion({ id: 'q-7' }))),
    });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/quiz', 'q-7'], {
      replaceUrl: true,
    });
  });

  it('laddar en specifik fråga från url:en', async () => {
    const get = vi.fn((id: string) =>
      of(makeQuestion({ id, question: 'Vad heter Norges huvudstad?' })),
    );
    const { random } = configure({ initialId: 'q-9', get });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(get).toHaveBeenCalledWith('q-9');
    expect(random).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Vad heter Norges huvudstad?',
    );
  });

  it('laddar om frågan när url:en ändras (t.ex. bakåtknappen)', async () => {
    const get = vi.fn((id: string) =>
      of(makeQuestion({ id, question: `Fråga ${id}` })),
    );
    const { paramMap$ } = configure({ initialId: 'q-1', get });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    paramMap$.next(convertToParamMap({ id: 'q-2' }));
    await fixture.whenStable();

    expect(get).toHaveBeenLastCalledWith('q-2');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Fråga q-2',
    );
  });

  it('hämtar en ny slumpmässig fråga och pushar historik vid "Nästa fråga"', async () => {
    const random = vi.fn(() => of(makeQuestion({ id: 'q-3' })));
    const { navigate } = configure({ random });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    navigate.mockClear();
    const el = fixture.nativeElement as HTMLElement;

    const nextBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Nästa fråga'),
    ) as HTMLButtonElement;
    nextBtn.click();
    await fixture.whenStable();

    expect(random).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith(['/quiz', 'q-3'], {
      replaceUrl: false,
    });
  });

  it('hämtar den specifika frågan på servern (SSR) för bra SEO', async () => {
    const get = vi.fn((id: string) =>
      of(makeQuestion({ id, question: 'Fråga på servern' })),
    );
    const { random } = configure({
      initialId: 'q-9',
      get,
      platform: 'server',
    });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(get).toHaveBeenCalledWith('q-9');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Fråga på servern',
    );
    expect(random).not.toHaveBeenCalled();
  });

  it('hämtar och renderar en slumpfråga på servern (SSR) utan att redirecta', async () => {
    const random = vi.fn(() => of(makeQuestion({ id: 'q-3', question: 'Slump på servern' })));
    const { navigate } = configure({ random, platform: 'server' });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(random).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Slump på servern',
    );

    const ts = TestBed.inject(TransferState);
    expect(ts.get(makeStateKey('home:randomId'), null)).toBe('q-3');
    expect(ts.get(makeStateKey('question:q-3'), null)).toBeTruthy();
  });

  it('återanvänder SSR-slumpfrågan: speglar id:t i url:en utan nytt anrop', async () => {
    const random = vi.fn(() => of(makeQuestion()));
    const { navigate } = configure({ random, platform: 'browser' });
    // Simulera att servern slumpade fram en fråga och la id:t i transfer-staten.
    TestBed.inject(TransferState).set(makeStateKey<string>('home:randomId'), 'q-5');

    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(random).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/quiz', 'q-5'], {
      replaceUrl: true,
    });
  });

  it('lägger den serverhämtade frågan i TransferState åt klienten', async () => {
    const get = vi.fn((id: string) => of(makeQuestion({ id })));
    configure({ initialId: 'q-9', get, platform: 'server' });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const ts = TestBed.inject(TransferState);
    expect(ts.get(makeStateKey('question:q-9'), null)).toBeTruthy();
  });

  it('återanvänder SSR-frågan från TransferState utan ett extra anrop', async () => {
    const get = vi.fn((id: string) => of(makeQuestion({ id })));
    configure({ initialId: 'q-9', get, platform: 'browser' });
    // Simulera att servern redan la frågan i transfer-staten.
    TestBed.inject(TransferState).set(
      makeStateKey<Question>('question:q-9'),
      makeQuestion({ id: 'q-9', question: 'Från servern' }),
    );

    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(get).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Från servern',
    );
  });

  it('visar rätt svar när man klickar "Visa svar"', async () => {
    configure({});
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const reveal = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Visa svar'),
    ) as HTMLButtonElement;
    reveal.click();
    await fixture.whenStable();

    expect(el.textContent).toContain('Rätt svar:');
    expect(el.textContent).toContain('Stockholm');
  });

  it('döljer svaret igen vid "Nästa fråga"', async () => {
    configure({});
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(text),
      ) as HTMLButtonElement;

    button('Visa svar').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Rätt svar:');

    button('Nästa fråga').click();
    await fixture.whenStable();
    expect(el.textContent).not.toContain('Rätt svar:');
  });

  it('sätter en frågespecifik sidtitel (SEO)', async () => {
    configure({
      random: vi.fn(() => of(makeQuestion({ question: 'Vad är ett primtal?' }))),
    });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(TestBed.inject(Title).getTitle()).toContain('Vad är ett primtal?');
  });

  it('visar frågans kategori', async () => {
    configure({ random: vi.fn(() => of(makeQuestion({ category: 'Geografi' }))) });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const category = el.querySelector('.category');
    expect(category?.textContent).toContain('Geografi');
  });

  it('döljer kategorin när frågan saknar kategori', async () => {
    configure({ random: vi.fn(() => of(makeQuestion({ category: null }))) });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.category')).toBeNull();
  });

  it('visar meddelande när det inte finns några frågor', async () => {
    configure({ random: vi.fn(() => of(null)) });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Inga frågor än.',
    );
  });
});
