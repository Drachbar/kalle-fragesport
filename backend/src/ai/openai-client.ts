import OpenAI from "openai";
import type { AnswerResearcher } from "./answer-researcher";
import {
  createOpenAiResearcher,
  type ResponsesRequest,
  type ResponsesResult,
} from "./openai-researcher";

/**
 * Skapar en riktig OpenAI-baserad researcher från en explicit nyckel.
 * Anropas först när ett jobb startas, så att appen kan köra utan nyckel
 * tills funktionen faktiskt används.
 */
export function createResearcherFromKey(
  apiKey: string,
  model: string = process.env.OPENAI_MODEL ?? "gpt-5",
): AnswerResearcher {
  if (!apiKey) {
    throw new Error("Ingen OpenAI-nyckel angiven för AI-uppdatering av svar");
  }

  const client = new OpenAI({ apiKey });

  return createOpenAiResearcher({
    model,
    create: async (req: ResponsesRequest): Promise<ResponsesResult> => {
      // Icke-strömmande anrop returnerar ett Response med output_text.
      const response = (await client.responses.create(
        req as Parameters<typeof client.responses.create>[0],
      )) as { output_text: string };
      return { output_text: response.output_text };
    },
  });
}
