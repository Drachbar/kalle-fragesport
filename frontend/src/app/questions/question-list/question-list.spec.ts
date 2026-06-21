import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QuestionList } from './question-list';
import { QuestionsService, type Question } from '../questions.service';
import { AuthService } from '../../auth/auth.service';

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    question: 'Sveriges huvudstad?',
    answer: 'Stockholm',
    options: ['Stockholm', 'Oslo'],
    category: 'Geografi',
    type: 'multiple_choice',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function configure(options: {
  isAdmin: boolean;
  questions?: Question[];
  del?: ReturnType<typeof vi.fn>;
}) {
  const questionsService = {
    list: () => of(options.questions ?? [makeQuestion()]),
    delete: options.del ?? vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    imports: [QuestionList],
    providers: [
      provideRouter([]),
      { provide: QuestionsService, useValue: questionsService },
      { provide: AuthService, useValue: { isAdmin: () => options.isAdmin } },
    ],
  });
  return questionsService;
}

describe('QuestionList', () => {
  it('listar frågor', async () => {
    configure({ isAdmin: false });
    const fixture = TestBed.createComponent(QuestionList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Sveriges huvudstad?');
    expect(el.textContent).toContain('Stockholm');
  });

  it('visar "Ny fråga" för admin', async () => {
    configure({ isAdmin: true });
    const fixture = TestBed.createComponent(QuestionList);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ny fråga',
    );
  });

  it('döljer admin-åtgärder för icke-admin', async () => {
    configure({ isAdmin: false });
    const fixture = TestBed.createComponent(QuestionList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Ny fråga');
    expect(el.querySelector('button')).toBeNull();
  });

  it('tar bort en fråga som admin', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const del = vi.fn(() => of(undefined));
    configure({ isAdmin: true, del });
    const fixture = TestBed.createComponent(QuestionList);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const removeBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ta bort'),
    ) as HTMLButtonElement;
    removeBtn.click();
    await fixture.whenStable();

    expect(del).toHaveBeenCalledWith('q-1');
    expect(el.textContent).not.toContain('Sveriges huvudstad?');
  });
});
