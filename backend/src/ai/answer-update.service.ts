import type { QuestionsRepository } from "../questions/questions.repository";
import type { SuggestionsRepository } from "../questions/suggestions.repository";
import type { JobsRepository } from "../questions/jobs.repository";
import type { AnswerResearcher } from "./answer-researcher";

/** Beroenden för ett auto-uppdateringsjobb (injiceras för testbarhet). */
export interface AutoUpdateDeps {
  questionsRepo: Pick<QuestionsRepository, "listAutoUpdate">;
  suggestionsRepo: Pick<SuggestionsRepository, "create">;
  jobsRepo: Pick<JobsRepository, "update">;
  researcher: AnswerResearcher;
}

/**
 * Går igenom alla tidskänsliga frågor, slår upp aktuella svar och skapar
 * förslag för dem som har ändrats. Uppdaterar jobbets progress löpande.
 *
 * Avsedd att köras i bakgrunden (utan await från route-lagret). Kastar aldrig
 * vidare – fel fångas och speglas i jobbets status.
 */
export async function runAutoUpdateJob(
  jobId: string,
  deps: AutoUpdateDeps,
): Promise<void> {
  const { questionsRepo, suggestionsRepo, jobsRepo, researcher } = deps;

  try {
    const questions = await questionsRepo.listAutoUpdate();
    await jobsRepo.update(jobId, { status: "running", total: questions.length });

    let processed = 0;
    let suggestionsCreated = 0;

    for (const question of questions) {
      try {
        const result = await researcher.research(question);

        if (result.changed && result.suggestedAnswer !== question.answer) {
          await suggestionsRepo.create({
            questionId: question.id,
            jobId,
            previousAnswer: question.answer,
            suggestedAnswer: result.suggestedAnswer,
            sources: result.sources,
            reasoning: result.reasoning,
            confidence: result.confidence,
          });
          suggestionsCreated += 1;
        }
      } catch (err) {
        // Ett fel på en enskild fråga ska inte stoppa hela jobbet.
        console.error(`Kunde inte uppdatera fråga ${question.id}:`, err);
      } finally {
        processed += 1;
        await jobsRepo.update(jobId, { processed, suggestionsCreated });
      }
    }

    await jobsRepo.update(jobId, {
      status: "completed",
      finishedAt: new Date(),
    });
  } catch (err) {
    await jobsRepo.update(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      finishedAt: new Date(),
    });
  }
}
