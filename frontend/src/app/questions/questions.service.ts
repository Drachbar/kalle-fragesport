import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type QuestionType = 'multiple_choice' | 'free_text' | 'true_false';

export interface Question {
  id: string;
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionInput {
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
}

@Injectable({ providedIn: 'root' })
export class QuestionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/questions';

  list(): Observable<Question[]> {
    return this.http.get<Question[]>(this.baseUrl, { withCredentials: true });
  }

  get(id: string): Observable<Question> {
    return this.http.get<Question>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }

  create(input: QuestionInput): Observable<Question> {
    return this.http.post<Question>(this.baseUrl, input, {
      withCredentials: true,
    });
  }

  update(id: string, input: QuestionInput): Observable<Question> {
    return this.http.put<Question>(`${this.baseUrl}/${id}`, input, {
      withCredentials: true,
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }
}
