import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAutoUpdateScheduler,
  type SchedulerDeps,
} from "./auto-update.scheduler";
import type { AnswerResearcher } from "./answer-researcher";

type TryRunExclusive = SchedulerDeps["db"]["tryRunExclusive"];

/** db där låset alltid tas (fn körs). */
function lockGranted(): SchedulerDeps["db"] {
  return {
    tryRunExclusive: vi.fn((_key: number, fn: () => Promise<unknown>) =>
      fn(),
    ) as unknown as TryRunExclusive,
  };
}

/** db där låset aldrig tas (fn körs inte). */
function lockDenied(): SchedulerDeps["db"] {
  return { tryRunExclusive: vi.fn(async () => null) as unknown as TryRunExclusive };
}

function makeDeps(over: Partial<SchedulerDeps> = {}): SchedulerDeps {
  const researcher: AnswerResearcher = { research: vi.fn() };
  return {
    db: lockGranted(),
    questionsRepo: {
      listAutoUpdate: vi.fn().mockResolvedValue([]),
      listDueForAutoUpdate: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      markChecked: vi.fn().mockResolvedValue(undefined),
    },
    suggestionsRepo: { create: vi.fn() },
    jobsRepo: {
      create: vi.fn().mockResolvedValue({ id: "job-1" }),
      update: vi.fn().mockResolvedValue(null),
      hasActive: vi.fn().mockResolvedValue(false),
    },
    createResearcher: vi.fn().mockReturnValue(researcher),
    runJob: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("createAutoUpdateScheduler.tick", () => {
  const original = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = original;
    }
  });

  it("startar ett jobb med onlyDue när låset tas och nyckel finns", async () => {
    const deps = makeDeps();
    await createAutoUpdateScheduler(deps).tick();

    expect(deps.jobsRepo.create).toHaveBeenCalled();
    expect(deps.runJob).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ onlyDue: true }),
    );
  });

  it("kör inget när låset inte tas (annan pod kör)", async () => {
    const deps = makeDeps({ db: lockDenied() });
    await createAutoUpdateScheduler(deps).tick();

    expect(deps.jobsRepo.create).not.toHaveBeenCalled();
    expect(deps.runJob).not.toHaveBeenCalled();
  });

  it("hoppar över när ett jobb redan kör", async () => {
    const deps = makeDeps();
    deps.jobsRepo.hasActive = vi.fn().mockResolvedValue(true);

    await createAutoUpdateScheduler(deps).tick();

    expect(deps.jobsRepo.create).not.toHaveBeenCalled();
    expect(deps.runJob).not.toHaveBeenCalled();
  });

  it("hoppar över helt när OPENAI_API_KEY saknas", async () => {
    delete process.env.OPENAI_API_KEY;
    const deps = makeDeps();

    await createAutoUpdateScheduler(deps).tick();

    expect(deps.db.tryRunExclusive).not.toHaveBeenCalled();
    expect(deps.jobsRepo.create).not.toHaveBeenCalled();
  });
});
