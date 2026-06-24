import type { Database } from "../db";
import type { QuestionsRepository } from "../questions/questions.repository";
import type { JobsRepository } from "../questions/jobs.repository";
import type { SuggestionsRepository } from "../questions/suggestions.repository";
import type { AnswerResearcher } from "./answer-researcher";
import { runAutoUpdateJob } from "./answer-update.service";
import { createLogger } from "../logging/logger";

const log = createLogger("ai:scheduler");

// Egen advisory-lock-nyckel (≠ MIGRATION_LOCK_KEY i pg-adapter) så att bara en
// instans/pod kör den schemalagda körningen åt gången.
export const SCHEDULER_LOCK_KEY = 827_493_002;

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

/** Beroenden för schemaläggaren (injiceras för testbarhet). */
export interface SchedulerDeps {
  db: Pick<Database, "tryRunExclusive">;
  questionsRepo: Pick<
    QuestionsRepository,
    "listAutoUpdate" | "listDueForAutoUpdate" | "getById" | "markChecked"
  >;
  suggestionsRepo: Pick<SuggestionsRepository, "create">;
  jobsRepo: Pick<JobsRepository, "create" | "update" | "hasActive">;
  createResearcher: (apiKey: string) => AnswerResearcher;
  runJob?: typeof runAutoUpdateJob;
}

export interface AutoUpdateScheduler {
  /** Kör en enskild kontroll direkt (används av timern och i test). */
  tick(): Promise<void>;
  start(): void;
  stop(): void;
}

/**
 * Skapar en schemaläggare som regelbundet startar ett auto-uppdateringsjobb för
 * de frågor vars kontrollintervall löpt ut. Bara den instans som tar ett
 * `pg_try_advisory_lock` kör – övriga poddar hoppar tyst över, så jobbet körs
 * aldrig dubbelt i t.ex. Kubernetes.
 *
 * Den schemalagda körningen har ingen inloggad admin och använder därför bara
 * den delade `OPENAI_API_KEY` från miljön. Saknas den hoppas körningen över.
 */
export function createAutoUpdateScheduler(
  deps: SchedulerDeps,
): AutoUpdateScheduler {
  const {
    db,
    questionsRepo,
    suggestionsRepo,
    jobsRepo,
    createResearcher,
    runJob = runAutoUpdateJob,
  } = deps;

  let timer: NodeJS.Timeout | undefined;

  async function tick(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log.warn(
        "Hoppar över schemalagd auto-uppdatering: OPENAI_API_KEY saknas",
      );
      return;
    }

    await db.tryRunExclusive(SCHEDULER_LOCK_KEY, async () => {
      if (await jobsRepo.hasActive()) {
        log.info("Hoppar över: ett jobb kör redan");
        return;
      }

      const researcher = createResearcher(apiKey);
      const job = await jobsRepo.create();
      log.info("Startar schemalagt auto-uppdateringsjobb", { jobId: job.id });
      // Awaitas inuti låset så att två poddar aldrig överlappar.
      await runJob(job.id, {
        questionsRepo,
        suggestionsRepo,
        jobsRepo,
        researcher,
        onlyDue: true,
      });
    });
  }

  function start(): void {
    if (timer) {
      return;
    }
    const intervalMs = Number(process.env.AUTO_UPDATE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
    log.info("Schemaläggare startad", { intervalMs });
    timer = setInterval(() => {
      tick().catch((err) => log.error("Schemalagd körning misslyckades", { err }));
    }, intervalMs);
    // Hindra inte processen från att avslutas enbart pga timern.
    timer.unref?.();
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  return { tick, start, stop };
}
