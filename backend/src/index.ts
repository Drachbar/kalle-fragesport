import { createServer } from "node:http";
import express, { Request, Response } from "express";
import session from "express-session";
import { runMigrations } from "./db/migrate";
import { DbSessionStore } from "./auth/session-store";
import { createAuthRouter } from "./auth/auth.routes";
import { createQuestionsRouter } from "./questions/questions.routes";
import { createAutoUpdateRouter } from "./ai/auto-update.routes";
import { createSettingsRouter } from "./settings/settings.routes";
import { createContactRouter } from "./contact/contact.routes";
import { createJobStatusSocket } from "./ai/job-status.socket";
import { loadBackendEnv } from "./load-env";
import { createLogger } from "./logging/logger";
import { createRequestLogger } from "./logging/request-logger";

loadBackendEnv();

const log = createLogger("server");

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT ?? 3000;
const isProd = process.env.NODE_ENV === "production";

const sessionSecret =
  process.env.SESSION_SECRET ?? (isProd ? undefined : "dev-only-insecure-secret");
if (!sessionSecret) {
  throw new Error("SESSION_SECRET måste sättas i produktion");
}

app.use(express.json());

if (isProd) {
  // Krävs för secure-cookies bakom en reverse proxy.
  app.set("trust proxy", 1);
}

const sessionMiddleware = session({
  store: new DbSessionStore(),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dagar
  },
});
app.use(sessionMiddleware);
app.use(createRequestLogger());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hej från Kalle Frågesport backend!" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// API:t exponeras under /api (matchar frontends proxy.conf.json).
app.use("/api/auth", createAuthRouter());
app.use("/api/settings", createSettingsRouter());
app.use("/api/contact", createContactRouter());
// AI-routerna måste ligga före questions-routern så att t.ex.
// /api/questions/suggestions inte fångas av GET /:id.
app.use("/api/questions", createAutoUpdateRouter());
app.use("/api/questions", createQuestionsRouter());

async function start(): Promise<void> {
  log.info("Startar server", { port, isProd });
  await runMigrations();
  await createJobStatusSocket(httpServer, sessionMiddleware);
  httpServer.listen(port, () => {
    log.info("Servern lyssnar", { url: `http://localhost:${port}` });
  });
}

start().catch((err) => {
  log.error("Kunde inte starta servern", { err });
  process.exit(1);
});
