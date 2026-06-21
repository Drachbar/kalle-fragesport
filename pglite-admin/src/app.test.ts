import { describe, expect, it } from "vitest";
import { createApp, parseFormValues, renderTablePage } from "./app.js";
import type { BrowserService } from "./app.js";
import type { TableInfo } from "./database-browser.js";

const table: TableInfo = {
  name: "questions",
  primaryKey: ["id"],
  columns: [
    { name: "id", dataType: "uuid", nullable: false, defaultValue: "gen_random_uuid()" },
    { name: "question", dataType: "text", nullable: false, defaultValue: null },
    { name: "options", dataType: "jsonb", nullable: false, defaultValue: "'[]'::jsonb" },
  ],
};

describe("web app", () => {
  it("renders an escaped table browser with edit actions", () => {
    const html = renderTablePage(
      ["questions"],
      table,
      [{ id: "abc", question: "Två & tre?", options: [2, 3] }],
      1,
      1,
    );

    expect(html).toContain("questions");
    expect(html).toContain("Två &amp; tre?");
    expect(html).toContain("Redigera");
  });

  it("shows column names when a table has no rows", () => {
    const html = renderTablePage(["questions"], table, [], 0, 1);

    expect(html).toContain("<th>id</th>");
    expect(html).toContain("<th>question</th>");
    expect(html).toContain("<th>options</th>");
    expect(html).toContain("Tabellen är tom.");
  });

  it("parses typed form values and leaves database defaults untouched", () => {
    expect(
      parseFormValues({ question: "Vad?", options: '["A","B"]', id: "" }, table, true),
    ).toEqual({ question: "Vad?", options: ["A", "B"] });
  });

  it("returns a useful validation error for invalid JSON", () => {
    expect(() => parseFormValues({ question: "Vad?", options: "[" }, table, true)).toThrow(
      "Ogiltig JSON",
    );
  });

  it("creates an Express application", () => {
    const browser = {} as BrowserService;
    const app = createApp(browser);
    expect(app).toBeTypeOf("function");
    expect(app.listen).toBeTypeOf("function");
  });
});
