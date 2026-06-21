import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  QuestionsService,
  type Question,
  type QuestionInput,
} from './questions.service';

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    question: 'Sveriges huvudstad?',
    answer: 'Stockholm',
    options: ['Stockholm', 'Oslo'],
    category: 'Geografi',
    type: 'multiple_choice',
    autoUpdate: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const input: QuestionInput = {
  question: 'Fråga?',
  answer: 'Svar',
  options: ['a', 'b'],
  category: null,
  type: 'multiple_choice',
  autoUpdate: false,
};

describe('QuestionsService', () => {
  let service: QuestionsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        QuestionsService,
      ],
    });
    service = TestBed.inject(QuestionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list hämtar alla frågor', () => {
    let result: Question[] | undefined;
    service.list().subscribe((q) => (result = q));

    const req = httpMock.expectOne('/api/questions');
    expect(req.request.method).toBe('GET');
    req.flush([makeQuestion()]);

    expect(result).toHaveLength(1);
  });

  it('get hämtar en fråga', () => {
    service.get('q-1').subscribe();
    const req = httpMock.expectOne('/api/questions/q-1');
    expect(req.request.method).toBe('GET');
    req.flush(makeQuestion());
  });

  it('random hämtar en slumpmässig fråga', () => {
    let result: Question | null | undefined;
    service.random().subscribe((q) => (result = q));

    const req = httpMock.expectOne('/api/questions/random');
    expect(req.request.method).toBe('GET');
    req.flush(makeQuestion());

    expect(result?.id).toBe('q-1');
  });

  it('create postar med credentials', () => {
    service.create(input).subscribe();
    const req = httpMock.expectOne('/api/questions');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(input);
    req.flush(makeQuestion());
  });

  it('update PUT:ar till rätt url', () => {
    service.update('q-1', input).subscribe();
    const req = httpMock.expectOne('/api/questions/q-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeQuestion());
  });

  it('delete DELETE:ar rätt url', () => {
    service.delete('q-1').subscribe();
    const req = httpMock.expectOne('/api/questions/q-1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });

  it('startAutoUpdate POST:ar och returnerar jobId', () => {
    let jobId: string | undefined;
    service.startAutoUpdate().subscribe((r) => (jobId = r.jobId));

    const req = httpMock.expectOne('/api/questions/auto-update');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ jobId: 'job-1' });

    expect(jobId).toBe('job-1');
  });

  it('getAutoUpdateStatus hämtar status för ett jobb', () => {
    service.getAutoUpdateStatus('job-1').subscribe();
    const req = httpMock.expectOne('/api/questions/auto-update/job-1');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      id: 'job-1',
      status: 'running',
      total: 3,
      processed: 1,
      suggestionsCreated: 0,
      error: null,
    });
  });

  it('listSuggestions hämtar väntande förslag', () => {
    let result: unknown[] | undefined;
    service.listSuggestions().subscribe((s) => (result = s));

    const req = httpMock.expectOne('/api/questions/suggestions');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 's-1',
        questionId: 'q-1',
        question: 'Hur många mål?',
        previousAnswer: '7',
        suggestedAnswer: '8',
        previousOptions: ['7', '6'],
        suggestedOptions: ['8', '7'],
        sources: [],
        reasoning: null,
        confidence: 0.9,
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it('approveSuggestion POST:ar till approve-url', () => {
    service.approveSuggestion('s-1').subscribe();
    const req = httpMock.expectOne('/api/questions/suggestions/s-1/approve');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 's-1', status: 'approved' });
  });

  it('rejectSuggestion POST:ar till reject-url', () => {
    service.rejectSuggestion('s-1').subscribe();
    const req = httpMock.expectOne('/api/questions/suggestions/s-1/reject');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 's-1', status: 'rejected' });
  });
});
