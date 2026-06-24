import { describe, it, expect } from "vitest";
import { createQuestionSchema } from "./questions.validation";

describe("createQuestionSchema", () => {
  it("godkänner en komplett giltig fråga", () => {
    const result = createQuestionSchema.safeParse({
      question: "Sveriges huvudstad?",
      answer: "Stockholm",
      options: ["Stockholm", "Oslo", "Helsingfors"],
      category: "Geografi",
      type: "multiple_choice",
    });

    expect(result.success).toBe(true);
  });

  it("sätter standardvärden för options och type", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fritextfråga?",
      answer: "Svar",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options).toEqual([]);
      expect(result.data.type).toBe("multiple_choice");
    }
  });

  it("sätter autoUpdate till false som standard", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoUpdate).toBe(false);
    }
  });

  it("godkänner autoUpdate = true", () => {
    const result = createQuestionSchema.safeParse({
      question: "Hur många mål har spelaren gjort i VM?",
      answer: "7",
      autoUpdate: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoUpdate).toBe(true);
    }
  });

  it("sätter updateIntervalDays till 30 som standard", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updateIntervalDays).toBe(30);
    }
  });

  it("avvisar updateIntervalDays under 1", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
      updateIntervalDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("sätter earliestUpdateAt och answerAsOf till null när de saknas", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.earliestUpdateAt).toBeNull();
      expect(result.data.answerAsOf).toBeNull();
    }
  });

  it("behåller angivna datum för earliestUpdateAt och answerAsOf", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
      earliestUpdateAt: "2026-09-01",
      answerAsOf: "2026-03-01",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.earliestUpdateAt).toBe("2026-09-01");
      expect(result.data.answerAsOf).toBe("2026-03-01");
    }
  });

  it("avvisar tom fråga", () => {
    const result = createQuestionSchema.safeParse({
      question: "",
      answer: "Svar",
    });
    expect(result.success).toBe(false);
  });

  it("avvisar okänd frågetyp", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
      type: "essä",
    });
    expect(result.success).toBe(false);
  });

  it("avvisar options som inte är en array av strängar", () => {
    const result = createQuestionSchema.safeParse({
      question: "Fråga?",
      answer: "Svar",
      options: "Stockholm",
    });
    expect(result.success).toBe(false);
  });
});
