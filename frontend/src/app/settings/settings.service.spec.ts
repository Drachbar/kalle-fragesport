import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SettingsService, type OpenAiKeyStatus } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        SettingsService,
      ],
    });
    service = TestBed.inject(SettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getOpenAiKeyStatus hämtar status med credentials', () => {
    const status: OpenAiKeyStatus = { envKeyPresent: false, userKeySet: true };
    let received: OpenAiKeyStatus | undefined;
    service.getOpenAiKeyStatus().subscribe((s) => (received = s));

    const req = httpMock.expectOne('/api/settings/openai-key');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(status);

    expect(received).toEqual(status);
  });

  it('saveOpenAiKey PUT:ar nyckeln', () => {
    service.saveOpenAiKey('sk-min-nyckel').subscribe();

    const req = httpMock.expectOne('/api/settings/openai-key');
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ apiKey: 'sk-min-nyckel' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deleteOpenAiKey DELETE:ar nyckeln', () => {
    service.deleteOpenAiKey().subscribe();

    const req = httpMock.expectOne('/api/settings/openai-key');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
