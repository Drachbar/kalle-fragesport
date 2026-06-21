import express, { Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { runMigrations } from "./db/migrate";
import { pool } from "./db/pool";
import { createAuthRouter } from "./auth/auth.routes";
import { createQuestionsRouter } from "./questions/questions.routes";

const app = express();
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

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dagar
    },
  }),
);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hej från Kalle Frågesport backend!" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/auth", createAuthRouter());
app.use("/questions", createQuestionsRouter());

async function start(): Promise<void> {
  await runMigrations();
  app.listen(port, () => {
    console.log(`Servern lyssnar på http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Kunde inte starta servern:", err);
  process.exit(1);
});
