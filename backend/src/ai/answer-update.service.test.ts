import { describe, it, expect, vi } from "vitest";
import { runAutoUpdateJob, type AutoUpdateDeps } from "./answer-update.service";
import type { Question } from "../questions/questions.types";
import type { ResearchResult } from "./answer-researcher";

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    question: "Hur många mål?",
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

function makeResult(over: Partial<ResearchResult> = {}): ResearchResult {
  return {
    changed: true,
    suggestedAnswer: "8",
    suggestedOptions: [],
    confidence: 0.9,
    sources: [{ url: "https://example.com", publishedAt: "2026-03-01" }],
    reasoning: "Ett mål till.",
    suggestedIntervalDays: 14,
    answerAsOf: "2026-03-01",
    suggestedEarliestUpdateAt: null,
    ...over,
  };
}

function makeDeps(over: {
  questions?: Question[];
  research?: (q: Question) => Promise<ResearchResult>;
  questionId?: string;
  onlyDue?: boolean;
  mode?: "answer" | "interval";
} = {}): AutoUpdateDeps {
  return {
    questionsRepo: {
      listAutoUpdate: vi
        .fn()
        .mockResolvedValue(over.questions ?? [makeQuestion()]),
      listDueForAutoUpdate: vi
        .fn()
        .mockResolvedValue(over.questions ?? [makeQuestion()]),
      getById: vi
        .fn()
        .mockResolvedValue(over.questions?.[0] ?? makeQuestion()),
      markChecked: vi.fn().mockResolvedValue(undefined),
      updateTiming: vi.fn().mockResolvedValue(undefined),
    },
    questionId: over.questionId,
    onlyDue: over.onlyDue,
    mode: over.mode,
    suggestionsRepo: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    jobsRepo: {
      update: vi.fn().mockResolvedValue(null),
    },
    researcher: {
      research: over.research ?? vi.fn().mockResolvedValue(makeResult()),
    },
  };
}

describe("runAutoUpdateJob", () => {
  it("sätter status running med rätt total och completed vid slutet", async () => {
    const deps = makeDeps({ questions: [makeQuestion()] });
    await runAutoUpdateJob("job-1", deps);

    expect(deps.jobsRepo.update).toHaveBeenCalledWith("job-1", {
      status: "running",
      total: 1,
    });
    const lastCall = (deps.jobsRepo.update as ReturnType<typeof vi.fn>).mock
      .calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({ status: "completed" });
    expect(lastCall?.[1].finishedAt).toBeInstanceOf(Date);
  });

  it("skapar förslag när svaret har ändrats", async () => {
    const deps = makeDeps({
      questions: [makeQuestion({ id: "q-1", answer: "7" })],
      research: vi.fn().mockResolvedValue(makeResult({ suggestedAnswer: "8" })),
    });
    await runAutoUpdateJob("job-1", deps);

    expect(deps.suggestionsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "q-1",
        jobId: "job-1",
        previousAnswer: "7",
        suggestedAnswer: "8",
        previousOptions: [],
        suggestedOptions: [],
        sources: [{ url: "https://example.com", publishedAt: "2026-03-01" }],
        suggestedIntervalDays: 14,
      }),
    );
  });

  it("markerar varje granskad fråga som kontrollerad", async () => {
    const deps = makeDeps({
      questions: [makeQuestion({ id: "q-1" }), makeQuestion({ id: "q-2" })],
      research: vi
        .fn()
        .mockResolvedValue(makeResult({ changed: false, suggestedAnswer: "7" })),
    });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.questionsRepo.markChecked).toHaveBeenCalledWith("q-1");
    expect(deps.questionsRepo.markChecked).toHaveBeenCalledWith("q-2");
  });

  it("kör bara förfallna frågor när onlyDue är satt", async () => {
    const deps = makeDeps({ onlyDue: true, questions: [makeQuestion()] });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.questionsRepo.listDueForAutoUpdate).toHaveBeenCalled();
    expect(deps.questionsRepo.listAutoUpdate).not.toHaveBeenCalled();
  });

  it("skriver tidsmetadata direkt på frågan (answer-läge)", async () => {
    const deps = makeDeps({
      questions: [makeQuestion({ id: "q-1" })],
      research: vi.fn().mockResolvedValue(
        makeResult({
          suggestedIntervalDays: 21,
          suggestedEarliestUpdateAt: "2026-09-01",
        }),
      ),
    });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.questionsRepo.updateTiming).toHaveBeenCalledWith("q-1", {
      updateIntervalDays: 21,
      earliestUpdateAt: "2026-09-01",
    });
  });

  it("uppdaterar bara tidsmetadata och skapar inget förslag i intervall-läge", async () => {
    const deps = makeDeps({
      mode: "interval",
      questions: [makeQuestion({ id: "q-1", answer: "7" })],
      research: vi.fn().mockResolvedValue(
        makeResult({ suggestedAnswer: "8", suggestedIntervalDays: 21 }),
      ),
    });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.questionsRepo.updateTiming).toHaveBeenCalledWith("q-1", {
      updateIntervalDays: 21,
      earliestUpdateAt: null,
    });
    expect(deps.suggestionsRepo.create).not.toHaveBeenCalled();
  });

  it("flaggar förslag vars info är äldre än nuvarande svar", async () => {
    const deps = makeDeps({
      questions: [
        makeQuestion({
          id: "q-1",
          answer: "Finland",
          answerAsOf: new Date("2026-02-22T00:00:00Z"),
        }),
      ],
      research: vi.fn().mockResolvedValue(
        makeResult({
          suggestedAnswer: "Kanada",
          answerAsOf: "2022-02-20",
        }),
      ),
    });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.suggestionsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanCurrent: true, answerAsOf: "2022-02-20" }),
    );
  });

  it("flaggar inte förslag när AI:ns info är nyare", async () => {
    const deps = makeDeps({
      questions: [
        makeQuestion({
          id: "q-1",
          answer: "Finland",
          answerAsOf: new Date("2022-02-20T00:00:00Z"),
        }),
      ],
      research: vi.fn().mockResolvedValue(
        makeResult({ suggestedAnswer: "Kanada", answerAsOf: "2026-02-22" }),
      ),
    });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.suggestionsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanCurrent: false }),
    );
  });

  it("skapar förslag när bara flervalsalternativen har ändrats", async () => {
    const deps = makeDeps({
      questions: [
        makeQuestion({
          answer: "Donald Trump",
          options: ["Joe Biden", "Barack Obama"],
          type: "multiple_choice",
        }),
      ],
      research: vi.fn().mockResolvedValue(
        makeResult({
          suggestedAnswer: "Donald Trump",
          suggestedOptions: ["Donald Trump", "Joe Biden", "Barack Obama"],
        }),
      ),
    });

    await runAutoUpdateJob("job-1", deps);

    expect(deps.suggestionsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        previousOptions: ["Joe Biden", "Barack Obama"],
        suggestedOptions: ["Donald Trump", "Joe Biden", "Barack Obama"],
      }),
    );
  });

  it("skapar inget förslag när svaret är oförändrat", async () => {
    const deps = makeDeps({
      research: vi
        .fn()
        .mockResolvedValue(
          makeResult({ changed: false, suggestedAnswer: "7", suggestedOptions: [] }),
        ),
    });
    await runAutoUpdateJob("job-1", deps);

    expect(deps.suggestionsRepo.create).not.toHaveBeenCalled();
  });

  it("skapar inget förslag när changed är true men svaret är identiskt", async () => {
    const deps = makeDeps({
      questions: [makeQuestion({ answer: "7" })],
      research: vi
        .fn()
        .mockResolvedValue(
          makeResult({
            changed: true,
            suggestedAnswer: "7",
            suggestedOptions: [],
          }),
        ),
    });
    await runAutoUpdateJob("job-1", deps);

    expect(deps.suggestionsRepo.create).not.toHaveBeenCalled();
  });

  it("fortsätter trots fel på en enskild fråga", async () => {
    const research = vi
      .fn()
      .mockRejectedValueOnce(new Error("API nere"))
      .mockResolvedValueOnce(makeResult({ suggestedAnswer: "9" }));
    const deps = makeDeps({
      questions: [makeQuestion({ id: "q-1" }), makeQuestion({ id: "q-2" })],
      research,
    });

    await runAutoUpdateJob("job-1", deps);

    // Andra frågan ska fortfarande ge ett förslag.
    expect(deps.suggestionsRepo.create).toHaveBeenCalledTimes(1);
    const lastCall = (deps.jobsRepo.update as ReturnType<typeof vi.fn>).mock
      .calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({ status: "completed" });
  });

  it("uppdaterar bara den valda frågan när questionId anges", async () => {
    const q = makeQuestion({ id: "q-42" });
    const deps = makeDeps({ questionId: "q-42", questions: [q] });
    deps.questionsRepo.getById = vi.fn().mockResolvedValue(q);

    await runAutoUpdateJob("job-1", deps);

    expect(deps.questionsRepo.getById).toHaveBeenCalledWith("q-42");
    expect(deps.questionsRepo.listAutoUpdate).not.toHaveBeenCalled();
    expect(deps.jobsRepo.update).toHaveBeenCalledWith("job-1", {
      status: "running",
      total: 1,
    });
  });

  it("completar med total 0 om den valda frågan saknas", async () => {
    const deps = makeDeps({ questionId: "saknas" });
    deps.questionsRepo.getById = vi.fn().mockResolvedValue(null);

    await runAutoUpdateJob("job-1", deps);

    expect(deps.jobsRepo.update).toHaveBeenCalledWith("job-1", {
      status: "running",
      total: 0,
    });
    expect(deps.suggestionsRepo.create).not.toHaveBeenCalled();
  });

  it("markerar jobbet som failed om listAutoUpdate kastar", async () => {
    const deps = makeDeps();
    deps.questionsRepo.listAutoUpdate = vi
      .fn()
      .mockRejectedValue(new Error("DB nere"));

    await runAutoUpdateJob("job-1", deps);

    const lastCall = (deps.jobsRepo.update as ReturnType<typeof vi.fn>).mock
      .calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({ status: "failed" });
    expect(lastCall?.[1].error).toContain("DB nere");
  });
});
