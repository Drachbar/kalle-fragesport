import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';
import type { Question } from '../questions/questions.service';

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    question: 'Sveriges huvudstad?',
    answer: 'Stockholm',
    options: ['Stockholm', 'Oslo'],
    category: 'Geografi',
    type: 'multiple_choice',
    autoUpdate: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function setup() {
  TestBed.configureTestingModule({});
  return {
    seo: TestBed.inject(SeoService),
    title: TestBed.inject(Title),
    meta: TestBed.inject(Meta),
    doc: TestBed.inject(DOCUMENT),
  };
}

describe('SeoService', () => {
  it('sätter en frågespecifik titel', () => {
    const { seo, title } = setup();
    seo.setQuestion(makeQuestion({ question: 'Vad heter Norges huvudstad?' }));

    expect(title.getTitle()).toContain('Vad heter Norges huvudstad?');
  });

  it('sätter en meta-description utan att avslöja svaret', () => {
    const { seo, meta } = setup();
    seo.setQuestion(makeQuestion());

    const description = meta.getTag('name="description"')?.content ?? '';
    expect(description).toContain('Sveriges huvudstad?');
    expect(description).toContain('Geografi');
    expect(description).not.toContain('Stockholm');
  });

  it('sätter en relativ canonical till /quiz/:id', () => {
    const { seo, doc } = setup();
    seo.setQuestion(makeQuestion({ id: 'abc-123' }));

    const link = doc.querySelector('link[rel="canonical"]');
    expect(link?.getAttribute('href')).toBe('/quiz/abc-123');
  });

  it('återanvänder samma canonical-element vid nästa fråga', () => {
    const { seo, doc } = setup();
    seo.setQuestion(makeQuestion({ id: 'first' }));
    seo.setQuestion(makeQuestion({ id: 'second' }));

    const links = doc.querySelectorAll('link[rel="canonical"]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/quiz/second');
  });
});
