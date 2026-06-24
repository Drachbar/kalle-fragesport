import { describe, it, expect, vi } from "vitest";
import {
  buildResearchRequest,
  parseResearchResult,
  createOpenAiResearcher,
  type ResponsesCreate,
} from "./openai-researcher";
import type { Question } from "../questions/questions.types";

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    question: "Hur många mål har spelaren gjort i VM totalt?",
    answer: "7",
    options: [],
    category: "Sport",
    type: "free_text",
    autoUpdate: true,
    updateIntervalDays: 30,
    lastCheckedAt: null,
    earliestUpdateAt: null,
    answerAsOf: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("buildResearchRequest", () => {
  it("aktiverar web_search och strukturerad JSON-output", () => {
    const req = buildResearchRequest(makeQuestion(), "gpt-5");

    expect(req.model).toBe("gpt-5");
    expect(req.tools).toEqual([{ type: "web_search" }]);
    expect(req.text?.format?.type).toBe("json_schema");
    expect(req.text?.format?.strict).toBe(true);
  });

  it("inkluderar frågan och det nuvarande svaret i prompten", () => {
    const req = buildResearchRequest(
      makeQuestion({ options: ["7", "8", "9"] }),
      "gpt-5",
    );
    const text = JSON.stringify(req.input);

    expect(text).toContain("Hur många mål har spelaren gjort i VM totalt?");
    expect(text).toContain("7");
    expect(text).toContain("8");
  });

  it("skriver in dagens datum i prompten", () => {
    const req = buildResearchRequest(
      makeQuestion(),
      "gpt-5",
      new Date("2026-02-15T12:00:00Z"),
    );
    const text = JSON.stringify(req.input);

    expect(text).toContain("Dagens datum: 2026-02-15");
    expect(text).toContain("suggestedIntervalDays");
  });

  it("härdar prompten mot äldre information och tar med svarets giltighetsdatum", () => {
    const req = buildResearchRequest(
      makeQuestion({ answerAsOf: new Date("2026-02-20T00:00:00Z") }),
      "gpt-5",
    );
    const text = JSON.stringify(req.input);

    expect(text).toContain("Nuvarande svar gäller per: 2026-02-20");
    expect(text).toContain("ALDRIG ett nyare svar med");
    expect(text).toContain("answerAsOf");
    expect(text).toContain("suggestedEarliestUpdateAt");
  });
});

describe("parseResearchResult", () => {
  it("parsar ett giltigt JSON-svar", () => {
    const result = parseResearchResult(
      JSON.stringify({
        changed: true,
        suggestedAnswer: "8",
        suggestedOptions: ["7", "8", "9"],
        confidence: 0.9,
        sources: [{ url: "https://example.com", publishedAt: "2026-03-01" }],
        reasoning: "Spelaren gjorde ett mål till.",
        suggestedIntervalDays: 14,
        answerAsOf: "2026-03-01",
        suggestedEarliestUpdateAt: "2026-06-01",
      }),
    );

    expect(result.changed).toBe(true);
    expect(result.suggestedAnswer).toBe("8");
    expect(result.suggestedOptions).toEqual(["7", "8", "9"]);
    expect(result.confidence).toBe(0.9);
    expect(result.sources).toEqual([
      { url: "https://example.com", publishedAt: "2026-03-01" },
    ]);
    expect(result.suggestedIntervalDays).toBe(14);
    expect(result.answerAsOf).toBe("2026-03-01");
    expect(result.suggestedEarliestUpdateAt).toBe("2026-06-01");
  });

  it("kastar fel vid ogiltig JSON", () => {
    expect(() => parseResearchResult("inte json")).toThrow();
  });

  it("kastar fel om obligatoriska fält saknas", () => {
    expect(() => parseResearchResult(JSON.stringify({ changed: true }))).toThrow();
  });
});

describe("createOpenAiResearcher", () => {
  it("anropar create och returnerar parsat resultat", async () => {
    const create: ResponsesCreate = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        changed: false,
        suggestedAnswer: "7",
        suggestedOptions: [],
        confidence: 0.8,
        sources: [],
        reasoning: "Oförändrat.",
        suggestedIntervalDays: 90,
        answerAsOf: null,
        suggestedEarliestUpdateAt: null,
      }),
    });

    const researcher = createOpenAiResearcher({ create, model: "gpt-5" });
    const result = await researcher.research(makeQuestion());

    expect(create).toHaveBeenCalledOnce();
    expect(result.changed).toBe(false);
    expect(result.suggestedAnswer).toBe("7");
  });

  it("avvisar flervalsförslag där rätt svar saknas bland alternativen", async () => {
    const create: ResponsesCreate = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        changed: true,
        suggestedAnswer: "8",
        suggestedOptions: ["6", "7", "9"],
        confidence: 0.9,
        sources: [{ url: "https://example.com", publishedAt: null }],
        reasoning: "Uppdaterat.",
        suggestedIntervalDays: 7,
        answerAsOf: null,
        suggestedEarliestUpdateAt: null,
      }),
    });
    const researcher = createOpenAiResearcher({ create, model: "gpt-5" });

    await expect(
      researcher.research(
        makeQuestion({
          type: "multiple_choice",
          options: ["6", "7", "8"],
        }),
      ),
    ).rejects.toThrow("saknas bland de föreslagna alternativen");
  });
});
