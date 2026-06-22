import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OpenAiKeyStatus {
  /** En delad OpenAI-nyckel finns i serverns miljö. */
  envKeyPresent: boolean;
  /** Den inloggade adminen har en egen sparad nyckel. */
  userKeySet: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/settings/openai-key';

  /** Hämtar status: finns en delad nyckel, och har adminen en egen sparad? */
  getOpenAiKeyStatus(): Observable<OpenAiKeyStatus> {
    return this.http.get<OpenAiKeyStatus>(this.url, { withCredentials: true });
  }

  /** Sparar (eller uppdaterar) adminens egna OpenAI-nyckel. */
  saveOpenAiKey(apiKey: string): Observable<void> {
    return this.http.put<void>(
      this.url,
      { apiKey },
      { withCredentials: true },
    );
  }

  /** Tar bort adminens egna OpenAI-nyckel. */
  deleteOpenAiKey(): Observable<void> {
    return this.http.delete<void>(this.url, { withCredentials: true });
  }
}
