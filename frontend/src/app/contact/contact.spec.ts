import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { Contact } from './contact';

function setInput(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submitForm(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).dispatchEvent(
    new Event('submit'),
  );
}

describe('Contact', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: [
        provideRouter([]),
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('skapar komponenten', () => {
    expect(TestBed.createComponent(Contact).componentInstance).toBeTruthy();
  });

  it('postar meddelandet till /api/contact och visar en bekräftelse', async () => {
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#contact-name', 'Anna');
    setInput(el, '#contact-email', 'anna@example.com');
    setInput(el, '#contact-message', 'Hej!');
    submitForm(el);

    const req = http.expectOne('/api/contact');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Anna',
      email: 'anna@example.com',
      message: 'Hej!',
      website: '',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(el.textContent).toContain('Tack');
  });

  it('skickar ingen förfrågan när formuläret är ofullständigt', async () => {
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#contact-name', 'Anna');
    submitForm(el);

    http.expectNone('/api/contact');
  });

  it('visar ett felmeddelande när utskicket misslyckas', async () => {
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    setInput(el, '#contact-name', 'Anna');
    setInput(el, '#contact-email', 'anna@example.com');
    setInput(el, '#contact-message', 'Hej!');
    submitForm(el);

    http
      .expectOne('/api/contact')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.textContent?.toLowerCase()).toContain('kunde inte');
  });
});
