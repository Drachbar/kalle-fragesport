import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { QuestionList } from './question-list';
import { QuestionsService, type Question } from '../questions.service';
import { AuthService } from '../../auth/auth.service';
import { JobStatusService } from '../job-status.service';

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

// Makrotask-tick: låt httpResource skicka sin förfrågan och applicera svaret.
// (whenStable() går inte – den väntar på den öppna förfrågan och deadlockar.)
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

function configure(options: {
  isAdmin: boolean;
  del?: ReturnType<typeof vi.fn>;
  service?: Record<string, unknown>;
  jobStatusService?: Record<string, unknown>;
}) {
  const del = options.del ?? vi.fn(() => of(undefined));
  TestBed.configureTestingModule({
    imports: [QuestionList],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: QuestionsService,
        useValue: { delete: del, ...options.service },
      },
      {
        provide: JobStatusService,
        useValue: { watch: vi.fn(), ...options.jobStatusService },
      },
      { provide: AuthService, useValue: { isAdmin: () => options.isAdmin } },
    ],
  });
  return { del, http: TestBed.inject(HttpTestingController) };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

/** Skapar komponenten och svarar på den första list-hämtningen. */
async function setup(http: HttpTestingController, questions: Question[]) {
  const fixture = TestBed.createComponent(QuestionList);
  fixture.detectChanges();
  await tick();
  http.expectOne('/api/questions').flush(questions);
  await tick();
  fixture.detectChanges();
  return fixture;
}

describe('QuestionList', () => {
  it('listar frågor från httpResource', async () => {
    const { http } = configure({ isAdmin: false });
    const fixture = await setup(http, [makeQuestion()]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sveriges huvudstad?');
    expect(el.textContent).toContain('Stockholm');
  });

  it('visar "Ny fråga" för admin', async () => {
    const { http } = configure({ isAdmin: true });
    const fixture = await setup(http, [makeQuestion()]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ny fråga',
    );
  });

  it('döljer admin-åtgärder för icke-admin', async () => {
    const { http } = configure({ isAdmin: false });
    const fixture = await setup(http, [makeQuestion()]);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Ny fråga');
    expect(el.querySelector('button')).toBeNull();
  });

  it('tar bort en fråga och laddar om listan', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const del = vi.fn(() => of(undefined));
    const { http } = configure({ isAdmin: true, del });
    const fixture = await setup(http, [makeQuestion()]);
    const el = fixture.nativeElement as HTMLElement;

    const removeBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ta bort'),
    ) as HTMLButtonElement;
    removeBtn.click();
    fixture.detectChanges();
    await tick();

    expect(del).toHaveBeenCalledWith('q-1');
    // .reload() utlöser en ny hämtning – nu tom.
    http.expectOne('/api/questions').flush([]);
    await tick();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Sveriges huvudstad?');
  });

  it('startar AI-uppdatering och visar resultatet när jobbet är klart', async () => {
    const startAutoUpdate = vi.fn(() => of({ jobId: 'job-1' }));
    const watch = vi.fn(() =>
      of({
        id: 'job-1',
        status: 'completed' as const,
        total: 2,
        processed: 2,
        suggestionsCreated: 1,
        error: null,
      }),
    );
    const { http } = configure({
      isAdmin: true,
      service: { startAutoUpdate },
      jobStatusService: { watch },
    });
    const fixture = await setup(http, [makeQuestion({ autoUpdate: true })]);
    const el = fixture.nativeElement as HTMLElement;

    const btn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Auto-uppdatera svar'),
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();

    expect(startAutoUpdate).toHaveBeenCalledOnce();
    expect(watch).toHaveBeenCalledWith('job-1');
    expect(el.textContent).toContain('1');
  });

  it('uppdaterar en enskild fråga med AI via questionId', async () => {
    const startAutoUpdate = vi.fn(() => of({ jobId: 'job-1' }));
    const watch = vi.fn(() =>
      of({
        id: 'job-1',
        status: 'completed' as const,
        total: 1,
        processed: 1,
        suggestionsCreated: 1,
        error: null,
      }),
    );
    const { http } = configure({
      isAdmin: true,
      service: { startAutoUpdate },
      jobStatusService: { watch },
    });
    const fixture = await setup(http, [makeQuestion({ id: 'q-1' })]);
    const el = fixture.nativeElement as HTMLElement;

    const btn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Uppdatera med AI'),
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();

    expect(startAutoUpdate).toHaveBeenCalledWith('q-1');
    expect(watch).toHaveBeenCalledWith('job-1');
  });

  it('visar serverns felmeddelande när AI-uppdateringen misslyckas', async () => {
    const startAutoUpdate = vi.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: {
              error:
                'Ingen OpenAI-nyckel konfigurerad – ange en egen under Inställningar',
            },
          }),
      ),
    );
    const { http } = configure({
      isAdmin: true,
      service: { startAutoUpdate },
    });
    const fixture = await setup(http, [makeQuestion({ autoUpdate: true })]);
    const el = fixture.nativeElement as HTMLElement;

    const btn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Auto-uppdatera svar'),
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();

    expect(el.textContent).toContain(
      'Ingen OpenAI-nyckel konfigurerad – ange en egen under Inställningar',
    );
  });

  it('döljer AI-knappen för icke-admin', async () => {
    const { http } = configure({ isAdmin: false });
    const fixture = await setup(http, [makeQuestion()]);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Auto-uppdatera svar',
    );
  });
});
