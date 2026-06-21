import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { DatabaseBrowser } from "./database-browser.js";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDirectory = path.resolve(appDirectory, "../backend/pgdata");
const dataDirectory = path.resolve(process.env.PGLITE_DATA_DIR ?? defaultDataDirectory);
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const database = new PGlite(dataDirectory);
const browser = new DatabaseBrowser(database);
const app = createApp(browser);

const server = app.listen(port, host, () => {
  console.log(`PGlite Admin: http://${host}:${port}`);
  console.log(`Databas: ${dataDirectory}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
