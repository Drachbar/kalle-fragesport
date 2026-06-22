import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import type { Question } from '../questions/questions.service';

const SITE_NAME = 'Kalle Frågesport';

/**
 * Sätter frågespecifika SEO-taggar (titel, description, canonical, Open Graph).
 * Körs även under SSR så taggarna finns i den serverrenderade HTML:en.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  setQuestion(question: Question): void {
    const title = `${question.question} – ${SITE_NAME}`;
    // Beskrivning utan rätt svar (ingen spoiler, och svaret hör inte hemma där).
    const description = question.category
      ? `Frågesport i kategorin ${question.category}: ${question.question}`
      : `Frågesport: ${question.question}`;

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    // Relativ canonical resolvas mot sidans URL, så startsidans slumpfråga och
    // /quiz/:id pekar på samma stabila adress utan att vi behöver publik origin.
    this.setCanonical(`/quiz/${question.id}`);
  }

  private setCanonical(href: string): void {
    let link = this.document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
