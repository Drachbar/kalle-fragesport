import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

const DEFAULT_ENV_FILE = resolve(__dirname, "../.env");

/**
 * Laddar backend/.env lokalt. En saknad fil är tillåten eftersom produktion
 * normalt injicerar miljövariabler via poddens runtime.
 */
export function loadBackendEnv(path = DEFAULT_ENV_FILE): void {
  try {
    loadEnvFile(path);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}
