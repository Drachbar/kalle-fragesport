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
  autoUpdate: boolean;
  updateIntervalDays: number;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionInput {
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
  autoUpdate: boolean;
  updateIntervalDays: number;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AutoUpdateJobStatus {
  id: string;
  status: JobStatus;
  total: number;
  processed: number;
  suggestionsCreated: number;
  error: string | null;
}

export interface PendingSuggestion {
  id: string;
  questionId: string;
  question: string;
  previousAnswer: string;
  suggestedAnswer: string;
  previousOptions: string[];
  suggestedOptions: string[];
  sources: string[];
  reasoning: string | null;
  confidence: number | null;
  suggestedIntervalDays: number | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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

  /** En slumpmässig fråga, eller null om databasen är tom (HTTP 204). */
  random(): Observable<Question | null> {
    return this.http.get<Question | null>(`${this.baseUrl}/random`, {
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

  /**
   * Startar ett AI-jobb som söker upp aktuella svar. Utan `questionId` körs alla
   * tidskänsliga frågor; med `questionId` uppdateras bara den valda frågan.
   */
  startAutoUpdate(questionId?: string): Observable<{ jobId: string }> {
    return this.http.post<{ jobId: string }>(
      `${this.baseUrl}/auto-update`,
      questionId ? { questionId } : {},
      { withCredentials: true },
    );
  }

  /** Hämtar status/progress för ett pågående jobb. */
  getAutoUpdateStatus(jobId: string): Observable<AutoUpdateJobStatus> {
    return this.http.get<AutoUpdateJobStatus>(
      `${this.baseUrl}/auto-update/${jobId}`,
      { withCredentials: true },
    );
  }

  /** Listar förslag som väntar på granskning. */
  listSuggestions(): Observable<PendingSuggestion[]> {
    return this.http.get<PendingSuggestion[]>(`${this.baseUrl}/suggestions`, {
      withCredentials: true,
    });
  }

  approveSuggestion(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/suggestions/${id}/approve`,
      {},
      { withCredentials: true },
    );
  }

  rejectSuggestion(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/suggestions/${id}/reject`,
      {},
      { withCredentials: true },
    );
  }
}
