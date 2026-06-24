import { z } from "zod";
import type { Question } from "../questions/questions.types";
import type {
  AnswerResearcher,
  ResearchResult,
} from "./answer-researcher";
import { createLogger } from "../logging/logger";

const log = createLogger("ai:researcher");

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
  required: [
    "changed",
    "suggestedAnswer",
    "suggestedOptions",
    "confidence",
    "sources",
    "reasoning",
    "suggestedIntervalDays",
    "answerAsOf",
    "suggestedEarliestUpdateAt",
  ],
  properties: {
    changed: {
      type: "boolean",
      description: "Behöver det nuvarande svaret ändras?",
    },
    suggestedAnswer: {
      type: "string",
      description: "Det aktuella, korrekta svaret.",
    },
    suggestedOptions: {
      type: "array",
      items: { type: "string" },
      description:
        "Komplett lista med aktuella flervalsalternativ; tom för fritext.",
    },
    confidence: {
      type: "number",
      description: "Säkerhet 0–1 i det föreslagna svaret.",
    },
    sources: {
      type: "array",
      description: "Källor som stöder svaret, med publiceringsdatum om känt.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "publishedAt"],
        properties: {
          url: { type: "string", description: "Käll-URL." },
          publishedAt: {
            type: ["string", "null"],
            description: "Publiceringsdatum (YYYY-MM-DD) om känt, annars null.",
          },
        },
      },
    },
    reasoning: {
      type: "string",
      description: "Kort motivering på svenska.",
    },
    suggestedIntervalDays: {
      type: "integer",
      description:
        "Antal dagar tills frågan bör kontrolleras igen, givet hur snabbt " +
        "svaret kan ändras och när nästa förändring väntas (minst 1).",
    },
    answerAsOf: {
      type: ["string", "null"],
      description:
        "Datum (YYYY-MM-DD) som det föreslagna svaret gäller per; null om ej daterbart.",
    },
    suggestedEarliestUpdateAt: {
      type: ["string", "null"],
      description:
        "Tidigast datum (YYYY-MM-DD) då svaret kan ändras härnäst (t.ex. nästa val " +
        "eller mästerskap); null om okänt.",
    },
  },
};

const sourceSchema = z.object({
  url: z.string(),
  publishedAt: z.string().nullable(),
});

const resultSchema = z.object({
  changed: z.boolean(),
  suggestedAnswer: z.string(),
  suggestedOptions: z.array(z.string()),
  confidence: z.number(),
  sources: z.array(sourceSchema),
  reasoning: z.string(),
  suggestedIntervalDays: z.number().int().min(1),
  answerAsOf: z.string().nullable(),
  suggestedEarliestUpdateAt: z.string().nullable(),
});

/** Formaterar ett datum som YYYY-MM-DD (UTC) för prompten. */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Bygger anropet till Responses API för en given fråga. */
export function buildResearchRequest(
  question: Question,
  model: string,
  now: Date = new Date(),
): ResponsesRequest {
  const answerAsOf = question.answerAsOf
    ? formatDate(question.answerAsOf)
    : "okänt";
  const earliestUpdate = question.earliestUpdateAt
    ? formatDate(question.earliestUpdateAt)
    : "-";
  const prompt = [
    "Du faktagranskar svar i en frågesport. Sök upp det mest aktuella, korrekta svaret.",
    `Dagens datum: ${formatDate(now)}`,
    `Fråga: ${question.question}`,
    `Nuvarande lagrade svar: ${question.answer}`,
    `Nuvarande svar gäller per: ${answerAsOf}`,
    `Tidigast uppdateras: ${earliestUpdate}`,
    `Frågetyp: ${question.type}`,
    `Nuvarande svarsalternativ: ${JSON.stringify(question.options)}`,
    `Nuvarande kontrollintervall (dagar): ${question.updateIntervalDays}`,
    // Färskhetsskydd: hindra modellen från att nedgradera till äldre information.
    "Sök aktivt efter den FÄRSKASTE informationen. Ersätt ALDRIG ett nyare svar med " +
      "äldre uppgifter – föreslå bara en ändring om du har en auktoritativ källa som " +
      'är NYARE än "Nuvarande svar gäller per". Hittar du inget nyare auktoritativt, ' +
      'sätt "changed" till false.',
    "För återkommande händelser (val, mästerskap, bokslut): identifiera den SENAST " +
      "genomförda instansen relativt dagens datum – inte en tidigare.",
    'Sätt "changed" till true om svaret eller flervalsalternativen behöver ändras.',
    "För multiple_choice: returnera en komplett lista med rimliga alternativ där suggestedAnswer ingår.",
    "För free_text: returnera suggestedOptions som en tom lista.",
    'För true_false: behåll alternativen ["Sant", "Falskt"].',
    "Svara kort och faktiskt, på samma format som det nuvarande svaret.",
    'Ange "answerAsOf" = datum (YYYY-MM-DD) som ditt föreslagna svar gäller per, och ' +
      '"publishedAt" per källa. Sätt datumen till null bara om de inte går att fastställa.',
    'Sätt "suggestedIntervalDays" till hur många dagar det bör dröja innan frågan ' +
      "kontrolleras igen. Utgå från dagens datum och bedöm hur snabbt svaret kan " +
      "ändras: slå upp när nästa förändring väntas (t.ex. ett val, en turnering, " +
      "ett bokslut) och välj ett intervall som vaknar lagom inför det. Stabila " +
      "fakta kan ha ett långt intervall, snabbrörliga ett kort.",
    'Sätt "suggestedEarliestUpdateAt" = tidigast datum (YYYY-MM-DD) då svaret kan ' +
      "ändras härnäst om ett sådant är känt (t.ex. nästa valdag eller mästerskap), annars null.",
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
  /** Injicerbar klocka så att prompten blir deterministisk i test. */
  now?: () => Date;
}): AnswerResearcher {
  return {
    async research(question) {
      const request = buildResearchRequest(
        question,
        opts.model,
        opts.now?.() ?? new Date(),
      );
      log.debug("Skickar förfrågan till OpenAI", {
        questionId: question.id,
        model: opts.model,
        tools: request.tools?.map((t) => t.type),
      });
      const start = Date.now();
      const response = await opts.create(request);
      log.debug("Rå-svar mottaget från OpenAI", {
        questionId: question.id,
        outputLength: response.output_text.length,
        durationMs: Date.now() - start,
      });

      const result = parseResearchResult(response.output_text);
      if (
        question.type === "multiple_choice" &&
        !result.suggestedOptions.includes(result.suggestedAnswer)
      ) {
        log.warn("AI-svaret saknas bland alternativen", {
          questionId: question.id,
          suggestedAnswer: result.suggestedAnswer,
          suggestedOptions: result.suggestedOptions,
        });
        throw new Error("AI-svaret saknas bland de föreslagna alternativen");
      }
      return result;
    },
  };
}
