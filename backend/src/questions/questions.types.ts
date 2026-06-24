export type QuestionType = "multiple_choice" | "free_text" | "true_false";

export interface Question {
  id: string;
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
  autoUpdate: boolean;
  /** Hur ofta (dagar) frågan bör kontrolleras av AI:n. */
  updateIntervalDays: number;
  /** När AI:n senast kontrollerade frågan; null om aldrig. */
  lastCheckedAt: Date | null;
  /** Tidigast datum då frågan ska kontrolleras; null = ingen gräns. */
  earliestUpdateAt: Date | null;
  /** Datum då nuvarande svar är aktuellt; null om okänt. */
  answerAsOf: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionInput {
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
  autoUpdate: boolean;
  updateIntervalDays: number;
  /** ISO-datum eller null. */
  earliestUpdateAt: string | null;
  /** ISO-datum eller null. */
  answerAsOf: string | null;
}
