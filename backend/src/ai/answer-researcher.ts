import type { Question } from "../questions/questions.types";

/** En källa som stöder ett föreslaget svar, med publiceringsdatum om känt. */
export interface ResearchSource {
  url: string;
  /** Publiceringsdatum (ISO) om det går att fastställa, annars null. */
  publishedAt: string | null;
}

/** Resultatet av att slå upp ett aktuellt svar på en fråga. */
export interface ResearchResult {
  /** Bedömer AI:n att det nuvarande svaret behöver ändras? */
  changed: boolean;
  /** Det föreslagna (aktuella) svaret. */
  suggestedAnswer: string;
  /** Uppdaterade flervalsalternativ; tom array för fritext. */
  suggestedOptions: string[];
  /** AI:ns säkerhet, 0–1. */
  confidence: number;
  /** Källor från webbsökningen som stöder svaret, med datum om känt. */
  sources: ResearchSource[];
  /** Kort motivering till bedömningen. */
  reasoning: string;
  /**
   * Hur ofta (dagar) frågan bör kontrolleras härnäst, givet hur snabbt svaret
   * kan ändras och när nästa förändring väntas.
   */
  suggestedIntervalDays: number;
  /** Datum (ISO) som det föreslagna svaret gäller per; null om ej daterbart. */
  answerAsOf: string | null;
  /** Tidigast datum (ISO) då svaret kan ändras härnäst; null om okänt. */
  suggestedEarliestUpdateAt: string | null;
}

/**
 * Slår upp ett aktuellt svar på en fråga (t.ex. via webbsökning).
 * Abstraktion så att orkestreringen kan testas utan riktig nätverkstrafik.
 */
export interface AnswerResearcher {
  research(question: Question): Promise<ResearchResult>;
}
