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
    const req = buildResearchRequest(makeQuestion(), "gpt-5");
    const text = JSON.stringify(req.input);

    expect(text).toContain("Hur många mål har spelaren gjort i VM totalt?");
    expect(text).toContain("7");
  });
});

describe("parseResearchResult", () => {
  it("parsar ett giltigt JSON-svar", () => {
    const result = parseResearchResult(
      JSON.stringify({
        changed: true,
        suggestedAnswer: "8",
        confidence: 0.9,
        sources: ["https://example.com"],
        reasoning: "Spelaren gjorde ett mål till.",
      }),
    );

    expect(result.changed).toBe(true);
    expect(result.suggestedAnswer).toBe("8");
    expect(result.confidence).toBe(0.9);
    expect(result.sources).toEqual(["https://example.com"]);
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
        confidence: 0.8,
        sources: [],
        reasoning: "Oförändrat.",
      }),
    });

    const researcher = createOpenAiResearcher({ create, model: "gpt-5" });
    const result = await researcher.research(makeQuestion());

    expect(create).toHaveBeenCalledOnce();
    expect(result.changed).toBe(false);
    expect(result.suggestedAnswer).toBe("7");
  });
});
