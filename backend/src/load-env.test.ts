import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadBackendEnv } from "./load-env";

const TEST_KEY = "KALLE_ENV_LOADER_TEST_VALUE";
const directories: string[] = [];

afterEach(async () => {
  delete process.env[TEST_KEY];
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("loadBackendEnv", () => {
  it("läser variabler från en angiven .env-fil", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kalle-env-"));
    directories.push(directory);
    const envFile = join(directory, ".env");
    await writeFile(envFile, `${TEST_KEY}=laddat\n`, "utf8");

    loadBackendEnv(envFile);

    expect(process.env[TEST_KEY]).toBe("laddat");
  });

  it("accepterar att .env saknas när miljövariabler injiceras externt", () => {
    expect(() => loadBackendEnv("/sökväg/som/inte/finns/.env")).not.toThrow();
  });
});
