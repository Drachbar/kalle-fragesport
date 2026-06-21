import express, { Request, Response } from "express";
import { runMigrations } from "./db/migrate";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hej från Kalle Frågesport backend!" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

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
