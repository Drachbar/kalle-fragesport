import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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

function configure(question: Question | null) {
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      {
        provide: QuestionsService,
        useValue: { random: () => of(question) },
      },
    ],
  });
}

describe('Home', () => {
  it('hämtar en slumpmässig fråga utan inloggning', async () => {
    configure(makeQuestion());
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sveriges huvudstad?');
    expect(el.textContent).not.toContain('Rätt svar:');
  });

  it('visar rätt svar när man klickar "Visa svar"', async () => {
    configure(makeQuestion());
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
    configure(makeQuestion());
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

  it('visar frågans kategori', async () => {
    configure(makeQuestion({ category: 'Geografi' }));
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const category = el.querySelector('.category');
    expect(category?.textContent).toContain('Geografi');
  });

  it('döljer kategorin när frågan saknar kategori', async () => {
    configure(makeQuestion({ category: null }));
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.category')).toBeNull();
  });

  it('visar meddelande när det inte finns några frågor', async () => {
    configure(null);
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Inga frågor än.',
    );
  });
});
