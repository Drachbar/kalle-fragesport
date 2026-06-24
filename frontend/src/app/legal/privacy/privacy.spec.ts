import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Privacy } from './privacy';

describe('Privacy', () => {
  let fixture: ComponentFixture<Privacy>;
  let text: string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Privacy],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Privacy);
    await fixture.whenStable();
    text = (fixture.nativeElement as HTMLElement).textContent ?? '';
  });

  it('skapar komponenten', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('visar rubriken Integritetspolicy', () => {
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent).toContain('Integritetspolicy');
  });

  it('anger personuppgiftsansvarig och hänvisar till kontaktformuläret', () => {
    expect(text).toContain('Mattias Andersson');
    expect(text.toLowerCase()).toContain('personuppgiftsansvarig');
    // Kontakt sker via formuläret i stället för en e-post i klartext.
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/kontakt"]',
    );
    expect(link).not.toBeNull();
  });

  it('beskriver vilka uppgifter som samlas in och de registrerades rättigheter', () => {
    expect(text.toLowerCase()).toContain('e-post');
    expect(text.toLowerCase()).toContain('cookie');
    expect(text.toLowerCase()).toContain('rättigheter');
    expect(text).toContain('Integritetsskyddsmyndigheten');
  });
});
