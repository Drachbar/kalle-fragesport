import { describe, it, expect, vi } from "vitest";
import { createLogger, type LogSink } from "./logger";

function makeSink(): LogSink & { calls: { level: string; line: string }[] } {
  const calls: { level: string; line: string }[] = [];
  return {
    calls,
    debug: (line: string) => calls.push({ level: "debug", line }),
    info: (line: string) => calls.push({ level: "info", line }),
    warn: (line: string) => calls.push({ level: "warn", line }),
    error: (line: string) => calls.push({ level: "error", line }),
  };
}

const fixedNow = () => new Date("2026-06-22T10:00:00.000Z");

describe("createLogger", () => {
  it("loggar meddelande med tidsstämpel, nivå och scope", () => {
    const sink = makeSink();
    const log = createLogger("ai:test", { level: "debug", sink, now: fixedNow });

    log.info("Hej");

    expect(sink.calls).toHaveLength(1);
    const { level, line } = sink.calls[0];
    expect(level).toBe("info");
    expect(line).toContain("2026-06-22T10:00:00.000Z");
    expect(line).toContain("INFO");
    expect(line).toContain("[ai:test]");
    expect(line).toContain("Hej");
  });

  it("inkluderar kontext som JSON", () => {
    const sink = makeSink();
    const log = createLogger("scope", { level: "debug", sink, now: fixedNow });

    log.info("Startar", { jobId: "job-1", count: 3 });

    expect(sink.calls[0].line).toContain('"jobId":"job-1"');
    expect(sink.calls[0].line).toContain('"count":3');
  });

  it("filtrerar bort nivåer under den valda nivån", () => {
    const sink = makeSink();
    const log = createLogger("scope", { level: "warn", sink, now: fixedNow });

    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    expect(sink.calls.map((c) => c.level)).toEqual(["warn", "error"]);
  });

  it("loggar ingenting på nivå silent", () => {
    const sink = makeSink();
    const log = createLogger("scope", { level: "silent", sink, now: fixedNow });

    log.error("händer inget");

    expect(sink.calls).toHaveLength(0);
  });

  it("serialiserar Error i kontexten med meddelande och stack", () => {
    const sink = makeSink();
    const log = createLogger("scope", { level: "debug", sink, now: fixedNow });

    log.error("Misslyckades", { err: new Error("trasig") });

    const line = sink.calls[0].line;
    expect(line).toContain("trasig");
    expect(line).toContain("stack");
  });

  it("child lägger till undernamn i scope", () => {
    const sink = makeSink();
    const log = createLogger("ai", { level: "debug", sink, now: fixedNow }).child(
      "job-1",
    );

    log.info("kör");

    expect(sink.calls[0].line).toContain("[ai:job-1]");
  });

  it("är tyst som standard under test (VITEST satt)", () => {
    const sink = makeSink();
    // Ingen explicit level → härleds från env. Vitest sätter VITEST=true.
    const log = createLogger("scope", { sink, now: fixedNow });

    log.error("ska inte synas i testkörning");

    expect(sink.calls).toHaveLength(0);
  });
});
