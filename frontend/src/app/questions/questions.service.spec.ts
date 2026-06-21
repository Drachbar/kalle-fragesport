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
});
