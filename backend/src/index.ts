import express, { Request, Response } from "express";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hej från Kalle Frågesport backend!" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Servern lyssnar på http://localhost:${port}`);
});
