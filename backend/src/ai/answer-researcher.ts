import type { Question } from "../questions/questions.types";

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
  /** Käll-URL:er från webbsökningen som stöder svaret. */
  sources: string[];
  /** Kort motivering till bedömningen. */
  reasoning: string;
}

/**
 * Slår upp ett aktuellt svar på en fråga (t.ex. via webbsökning).
 * Abstraktion så att orkestreringen kan testas utan riktig nätverkstrafik.
 */
export interface AnswerResearcher {
  research(question: Question): Promise<ResearchResult>;
}
