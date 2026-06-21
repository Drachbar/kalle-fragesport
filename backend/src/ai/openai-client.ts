import OpenAI from "openai";
import type { AnswerResearcher } from "./answer-researcher";
import {
  createOpenAiResearcher,
  type ResponsesRequest,
  type ResponsesResult,
} from "./openai-researcher";

/**
 * Skapar en riktig OpenAI-baserad researcher från miljövariabler.
 * Anropas först när ett jobb startas, så att appen kan köra utan nyckel
 * tills funktionen faktiskt används.
 */
export function createResearcherFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AnswerResearcher {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY måste sättas för AI-uppdatering av svar");
  }

  const client = new OpenAI({ apiKey });
  const model = env.OPENAI_MODEL ?? "gpt-5";

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
