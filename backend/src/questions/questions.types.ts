export type QuestionType = "multiple_choice" | "free_text" | "true_false";

export interface Question {
  id: string;
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
  autoUpdate: boolean;
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
}
