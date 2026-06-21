import { describe, expect, it, vi } from "vitest";
import { DatabaseBrowser, type QueryExecutor } from "./database-browser.js";

function executorWithRows(rows: Record<string, unknown>[]): QueryExecutor {
  return { query: vi.fn().mockResolvedValue({ rows, affectedRows: 1 }) };
}

describe("DatabaseBrowser", () => {
  it("lists only user tables in the public schema", async () => {
    const db = executorWithRows([{ name: "questions" }]);
    const browser = new DatabaseBrowser(db);

    await expect(browser.listTables()).resolves.toEqual(["questions"]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("table_schema = 'public'"));
  });

  it("quotes table names and paginates rows with bound values", async () => {
    const db = executorWithRows([{ id: "a" }]);
    const browser = new DatabaseBrowser(db);

    await browser.listRows('odd"table', 3, 25);

    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM "public"."odd""table" LIMIT $1 OFFSET $2',
      [25, 50],
    );
  });

  it("inserts only supplied editable values and returns the created row", async () => {
    const db = executorWithRows([{ id: "new-id", title: "Hej" }]);
    const browser = new DatabaseBrowser(db);

    await browser.insertRow("questions", { title: "Hej", category: null });

    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO "public"."questions" ("title", "category") VALUES ($1, $2) RETURNING *',
      ["Hej", null],
    );
  });

  it("updates and deletes by every primary-key column", async () => {
    const db = executorWithRows([{ tenant_id: 7, id: "q", title: "Ny" }]);
    const browser = new DatabaseBrowser(db);

    await browser.updateRow(
      "questions",
      { tenant_id: 7, id: "q" },
      { title: "Ny" },
    );
    await browser.deleteRow("questions", { tenant_id: 7, id: "q" });

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'UPDATE "public"."questions" SET "title" = $1 WHERE "tenant_id" = $2 AND "id" = $3 RETURNING *',
      ["Ny", 7, "q"],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM "public"."questions" WHERE "tenant_id" = $1 AND "id" = $2 RETURNING *',
      [7, "q"],
    );
  });

  it("rejects destructive operations without a primary key", async () => {
    const browser = new DatabaseBrowser(executorWithRows([]));

    await expect(browser.deleteRow("logs", {})).rejects.toThrow("primärnyckel");
    await expect(browser.updateRow("logs", {}, { message: "x" })).rejects.toThrow(
      "primärnyckel",
    );
  });

  it("can insert a row using only database defaults", async () => {
    const db = executorWithRows([{ id: "generated" }]);
    const browser = new DatabaseBrowser(db);

    await browser.insertRow("events", {});

    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO "public"."events" DEFAULT VALUES RETURNING *',
    );
  });
});
