import type { QuestionsRepository } from "../questions/questions.repository";
import type { Question } from "../questions/questions.types";
import type { SuggestionsRepository } from "../questions/suggestions.repository";
import type { JobsRepository } from "../questions/jobs.repository";
import type { AnswerResearcher } from "./answer-researcher";

function optionsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((option, index) => option === right[index])
  );
}

/** Hämtar en enskild fråga; tom lista om den inte finns. */
async function resolveSingleQuestion(
  questionsRepo: Pick<QuestionsRepository, "getById">,
  questionId: string,
): Promise<Question[]> {
  const question = await questionsRepo.getById(questionId);
  return question ? [question] : [];
}

/** Beroenden för ett auto-uppdateringsjobb (injiceras för testbarhet). */
export interface AutoUpdateDeps {
  questionsRepo: Pick<QuestionsRepository, "listAutoUpdate" | "getById">;
  suggestionsRepo: Pick<SuggestionsRepository, "create">;
  jobsRepo: Pick<JobsRepository, "update">;
  researcher: AnswerResearcher;
  /**
   * Om satt: uppdatera bara denna fråga (oavsett autoUpdate-flaggan).
   * Annars körs alla frågor som är markerade för auto-uppdatering.
   */
  questionId?: string;
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
  const { questionsRepo, suggestionsRepo, jobsRepo, researcher, questionId } =
    deps;

  try {
    // En specifik fråga (vald av admin) eller alla auto-uppdaterade frågor.
    const questions = questionId
      ? await resolveSingleQuestion(questionsRepo, questionId)
      : await questionsRepo.listAutoUpdate();
    await jobsRepo.update(jobId, { status: "running", total: questions.length });

    let processed = 0;
    let suggestionsCreated = 0;

    for (const question of questions) {
      try {
        const result = await researcher.research(question);

        const suggestedOptions =
          question.type === "multiple_choice"
            ? result.suggestedOptions
            : question.options;
        const answerChanged = result.suggestedAnswer !== question.answer;
        const optionsChanged = !optionsEqual(
          suggestedOptions,
          question.options,
        );

        if (result.changed && (answerChanged || optionsChanged)) {
          await suggestionsRepo.create({
            questionId: question.id,
            jobId,
            previousAnswer: question.answer,
            suggestedAnswer: result.suggestedAnswer,
            previousOptions: question.options,
            suggestedOptions,
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
