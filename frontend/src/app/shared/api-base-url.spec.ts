import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL, apiBaseUrlInterceptor } from './api-base-url';

function setup(baseUrl: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: baseUrl },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    ctrl: TestBed.inject(HttpTestingController),
  };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('apiBaseUrlInterceptor', () => {
  it('lämnar rot-relativa URL:er orörda när basen är tom', () => {
    const { http, ctrl } = setup('');
    http.get('/api/questions/random').subscribe();
    ctrl.expectOne('/api/questions/random');
  });

  it('prefixar rot-relativa URL:er med basen när den är satt', () => {
    const { http, ctrl } = setup('http://localhost:3000');
    http.get('/api/questions/random').subscribe();
    ctrl.expectOne('http://localhost:3000/api/questions/random');
  });

  it('rör inte URL:er som redan är absoluta', () => {
    const { http, ctrl } = setup('http://localhost:3000');
    http.get('https://example.com/api/x').subscribe();
    ctrl.expectOne('https://example.com/api/x');
  });
});
