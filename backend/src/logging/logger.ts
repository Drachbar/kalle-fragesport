/**
 * Liten, beroendefri logger. Skriver tidsstämplade, nivå- och scope-märkta rader
 * till konsolen med valfri JSON-kontext. Nivå styrs av LOG_LEVEL (default "debug"
 * så att man ser allt; "silent" under testkörning för att hålla output ren).
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

/** Mottagare av färdigformaterade rader (console som standard, mockbar i test). */
export interface LogSink {
  debug(line: string): void;
  info(line: string): void;
  warn(line: string): void;
  error(line: string): void;
}

export interface LoggerOptions {
  level?: LogLevel;
  sink?: LogSink;
  now?: () => Date;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  /** Skapar en logger med utökat scope, t.ex. "ai" → "ai:job-1". */
  child(scope: string): Logger;
}

function isTestEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.VITEST) || env.NODE_ENV === "test";
}

function resolveLevel(env: NodeJS.ProcessEnv): LogLevel {
  const raw = env.LOG_LEVEL?.toLowerCase();
  if (raw && raw in LEVEL_ORDER) {
    return raw as LogLevel;
  }
  return isTestEnv(env) ? "silent" : "debug";
}

/** JSON.stringify-replacer som gör Error serialiserbar (annars blir den "{}"). */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  try {
    return ` ${JSON.stringify(context, replacer)}`;
  } catch {
    return " [okontextualiserbar kontext]";
  }
}

export function createLogger(
  scope: string,
  options: LoggerOptions = {},
): Logger {
  const sink = options.sink ?? console;
  const now = options.now ?? (() => new Date());
  const level = options.level ?? resolveLevel(process.env);
  const threshold = LEVEL_ORDER[level];

  function emit(
    method: keyof LogSink,
    levelName: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[method as LogLevel] < threshold) {
      return;
    }
    const line = `${now().toISOString()} ${levelName} [${scope}] ${message}${formatContext(context)}`;
    sink[method](line);
  }

  return {
    debug: (message, context) => emit("debug", "DEBUG", message, context),
    info: (message, context) => emit("info", "INFO", message, context),
    warn: (message, context) => emit("warn", "WARN", message, context),
    error: (message, context) => emit("error", "ERROR", message, context),
    child: (sub) => createLogger(`${scope}:${sub}`, { ...options, level }),
  };
}
