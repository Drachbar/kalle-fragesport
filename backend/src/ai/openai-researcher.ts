import { z } from "zod";
import type { Question } from "../questions/questions.types";
import type { AnswerResearcher, ResearchResult } from "./answer-researcher";

/**
 * Minimal typ för OpenAI Responses API-anropet. Vi typar bara det vi använder
 * så att logiken kan testas utan att vara beroende av SDK:ns fulla typer.
 */
export interface ResponsesRequest {
  model: string;
  input: unknown;
  tools?: { type: string }[];
  text?: {
    format?: {
      type: string;
      name?: string;
      strict?: boolean;
      schema?: Record<string, unknown>;
    };
  };
}

export interface ResponsesResult {
  output_text: string;
}

export type ResponsesCreate = (
  req: ResponsesRequest,
) => Promise<ResponsesResult>;

// Strukturen vi tvingar modellen att svara med (JSON Schema, strict).
const RESEARCH_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["changed", "suggestedAnswer", "confidence", "sources", "reasoning"],
  properties: {
    changed: {
      type: "boolean",
      description: "Behöver det nuvarande svaret ändras?",
    },
    suggestedAnswer: {
      type: "string",
      description: "Det aktuella, korrekta svaret.",
    },
    confidence: {
      type: "number",
      description: "Säkerhet 0–1 i det föreslagna svaret.",
    },
    sources: {
      type: "array",
      items: { type: "string" },
      description: "Käll-URL:er som stöder svaret.",
    },
    reasoning: {
      type: "string",
      description: "Kort motivering på svenska.",
    },
  },
};

const resultSchema = z.object({
  changed: z.boolean(),
  suggestedAnswer: z.string(),
  confidence: z.number(),
  sources: z.array(z.string()),
  reasoning: z.string(),
});

/** Bygger anropet till Responses API för en given fråga. */
export function buildResearchRequest(
  question: Question,
  model: string,
): ResponsesRequest {
  const prompt = [
    "Du faktagranskar svar i en frågesport. Sök upp det mest aktuella, korrekta svaret.",
    `Fråga: ${question.question}`,
    `Nuvarande lagrade svar: ${question.answer}`,
    'Sätt "changed" till true endast om det nuvarande svaret är inaktuellt eller felaktigt.',
    "Svara kort och faktiskt, på samma format som det nuvarande svaret.",
  ].join("\n");

  return {
    model,
    input: prompt,
    tools: [{ type: "web_search" }],
    text: {
      format: {
        type: "json_schema",
        name: "answer_review",
        strict: true,
        schema: RESEARCH_SCHEMA,
      },
    },
  };
}

/** Parsar och validerar modellens JSON-svar. Kastar fel vid ogiltigt svar. */
export function parseResearchResult(outputText: string): ResearchResult {
  const json: unknown = JSON.parse(outputText);
  return resultSchema.parse(json);
}

/** Skapar en researcher kring en injicerad `create`-funktion (testbar). */
export function createOpenAiResearcher(opts: {
  create: ResponsesCreate;
  model: string;
}): AnswerResearcher {
  return {
    async research(question) {
      const response = await opts.create(
        buildResearchRequest(question, opts.model),
      );
      return parseResearchResult(response.output_text);
    },
  };
}
