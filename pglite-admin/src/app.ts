import express, {type Express, type Request} from "express";
import type {ColumnInfo, Row, TableInfo} from "./database-browser.js";

export interface BrowserService {
    listTables(): Promise<string[]>;

    describeTable(name: string): Promise<TableInfo>;

    listRows(table: string, page: number, pageSize: number): Promise<Row[]>;

    countRows(table: string): Promise<number>;

    getRow(table: string, key: Row): Promise<Row | null>;

    insertRow(table: string, values: Row): Promise<Row>;

    updateRow(table: string, key: Row, values: Row): Promise<Row>;

    deleteRow(table: string, key: Row): Promise<Row>;
}

const styles = `
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#18211b;background:#f3f5ef;font-synthesis:none}*{box-sizing:border-box}body{margin:0}a{color:inherit}.shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.sidebar{background:#13271d;color:#e8f0e9;padding:30px 20px}.brand{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:750;margin-bottom:28px}.mark{width:30px;height:30px;border-radius:9px;background:#c7f36b;color:#13271d;display:grid;place-items:center}.eyebrow{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#8ca093;margin:28px 8px 10px}.nav{display:flex;flex-direction:column;gap:4px}.nav a{padding:9px 10px;border-radius:8px;text-decoration:none;overflow:hidden;text-overflow:ellipsis}.nav a:hover,.nav a.active{background:#254332}.main{padding:34px;min-width:0}.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}h1{font-size:30px;letter-spacing:-.04em;margin:0}h2{font-size:20px;margin:0 0 16px}.muted{color:#68726b;font-size:13px}.card{background:#fff;border:1px solid #dfe4dc;border-radius:14px;box-shadow:0 3px 14px #16351f0a;overflow:hidden}.pad{padding:22px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;background:#f8f9f6;color:#647069;font-size:11px;text-transform:uppercase;letter-spacing:.06em}th,td{padding:12px 14px;border-bottom:1px solid #e7eae4;max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}tr:last-child td{border-bottom:0}.value-null{color:#9aa29d;font-style:italic}.value-json{font-family:ui-monospace,SFMono-Regular,monospace;color:#315d47}.actions{display:flex;gap:8px;align-items:center}.button,button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;padding:9px 13px;background:#173b29;color:white;text-decoration:none;font-weight:650;font-size:13px;cursor:pointer}.button.secondary,button.secondary{background:#edf1eb;color:#254332}.button.danger,button.danger{background:#fff0ed;color:#a93223}.field{margin-bottom:17px}.field label{display:block;font-size:13px;font-weight:700;margin-bottom:7px}.meta{font-weight:400;color:#7a847d;margin-left:6px}.field input,.field textarea,.field select{width:100%;border:1px solid #ccd3ca;border-radius:8px;padding:10px 11px;background:white;color:#18211b;font:inherit}.field textarea{min-height:90px;resize:vertical;font-family:ui-monospace,SFMono-Regular,monospace}.null-toggle{display:flex!important;align-items:center;gap:7px;font-weight:400!important;margin-top:7px}.null-toggle input{width:auto}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}.form-actions{display:flex;gap:9px;border-top:1px solid #e5e9e2;padding-top:18px}.notice{padding:14px 16px;border-radius:9px;margin-bottom:18px;background:#fff2ee;color:#8f2e20;border:1px solid #ffd5cd}.empty{padding:50px;text-align:center;color:#758078}.pagination{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-top:1px solid #e7eae4}.danger-zone{margin-top:20px;border-color:#f0d3ce}.danger-zone .pad{display:flex;justify-content:space-between;align-items:center;gap:20px}@media(max-width:800px){.shell{display:block}.sidebar{padding:16px}.nav{flex-direction:row;overflow:auto}.eyebrow{display:none}.brand{margin-bottom:13px}.main{padding:20px}.form-grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}
`;

function escapeHtml(value: unknown): string {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function urlPart(value: string): string {
    return encodeURIComponent(value);
}

function encodeKey(key: Row): string {
    return Buffer.from(JSON.stringify(key)).toString("base64url");
}

function decodeKey(encoded: string): Row {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Ogiltig radnyckel.");
    }
    return parsed as Row;
}

function rowKey(table: TableInfo, row: Row): Row | null {
    if (table.primaryKey.length === 0) return null;
    return Object.fromEntries(table.primaryKey.map((column) => [column, row[column]]));
}

function layout(tables: string[], active: string | null, title: string, content: string): string {
    const links = tables
        .map(
            (table) =>
                `<a class="${table === active ? "active" : ""}" href="/tables/${urlPart(table)}">${escapeHtml(table)}</a>`,
        )
        .join("");
    return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · PGlite Admin</title><style>${styles}</style></head><body><div class="shell"><aside class="sidebar"><div class="brand"><span class="mark">P</span>PGlite Admin</div><div class="eyebrow">Public schema</div><nav class="nav">${links || '<span class="muted">Inga tabeller</span>'}</nav></aside><main class="main">${content}</main></div></body></html>`;
}

function displayValue(value: unknown): string {
    if (value === null) return '<span class="value-null">NULL</span>';
    if (typeof value === "object") {
        return `<span class="value-json">${escapeHtml(JSON.stringify(value))}</span>`;
    }
    return escapeHtml(value);
}

function textValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
}

function field(column: ColumnInfo, value: unknown, creating: boolean): string {
    const isJson = column.dataType === "json" || column.dataType === "jsonb";
    const input = isJson
        ? `<textarea id="f-${escapeHtml(column.name)}" name="${escapeHtml(column.name)}">${escapeHtml(textValue(value))}</textarea>`
        : `<input id="f-${escapeHtml(column.name)}" name="${escapeHtml(column.name)}" value="${escapeHtml(textValue(value))}"${column.dataType === "boolean" ? ' placeholder="true eller false"' : ""}>`;
    const defaultHint = creating && column.defaultValue ? ` · standard: ${escapeHtml(column.defaultValue)}` : "";
    const nullable = column.nullable
        ? `<label class="null-toggle"><input type="checkbox" name="__null_${escapeHtml(column.name)}" value="1"> Sätt NULL</label>`
        : "";
    return `<div class="field"><label for="f-${escapeHtml(column.name)}">${escapeHtml(column.name)} <span class="meta">${escapeHtml(column.dataType)}${column.nullable ? " · nullable" : ""}${defaultHint}</span></label>${input}${nullable}</div>`;
}

function parseValue(raw: string, column: ColumnInfo): unknown {
    if (column.dataType === "json" || column.dataType === "jsonb") {
        try {
            return JSON.parse(raw) as unknown;
        } catch {
            throw new Error(`Ogiltig JSON i ${column.name}.`);
        }
    }
    if (["smallint", "integer", "real", "double precision", "numeric", "decimal"].includes(column.dataType)) {
        const number = Number(raw);
        if (!Number.isFinite(number)) throw new Error(`${column.name} måste vara ett tal.`);
        return number;
    }
    if (column.dataType === "boolean") {
        if (raw === "true" || raw === "1") return true;
        if (raw === "false" || raw === "0") return false;
        throw new Error(`${column.name} måste vara true eller false.`);
    }
    return raw;
}

export function parseFormValues(
    body: Record<string, string | undefined>,
    table: TableInfo,
    creating: boolean,
): Row {
    const values: Row = {};
    for (const column of table.columns) {
        const raw = body[column.name];
        const isNull = body[`__null_${column.name}`] === "1";
        if (isNull) {
            values[column.name] = null;
        } else if (raw !== undefined && (!creating || raw !== "" || !column.defaultValue)) {
            values[column.name] = parseValue(raw, column);
        }
    }
    return values;
}

function formValues(req: Request, table: TableInfo, creating: boolean): Row {
    return parseFormValues(req.body as Record<string, string | undefined>, table, creating);
}

export function renderTablePage(
    tables: string[],
    table: TableInfo,
    rows: Row[],
    count: number,
    page: number,
): string {
    const headers = table.columns.map(({name}) => `<th>${escapeHtml(name)}</th>`).join("");
    const body = rows
        .map((row) => {
            const cells = table.columns.map(({name}) => `<td>${displayValue(row[name])}</td>`).join("");
            const key = rowKey(table, row);
            const action = key
                ? `<td><a class="button secondary" href="/tables/${urlPart(table.name)}/rows/${encodeKey(key)}">Redigera</a></td>`
                : "<td><span class=\"muted\">Saknar primärnyckel</span></td>";
            return `<tr>${cells}${action}</tr>`;
        })
        .join("");
    const totalPages = Math.max(1, Math.ceil(count / 50));
    const previous = page > 1 ? `<a class="button secondary" href="?page=${page - 1}">Föregående</a>` : "<span></span>";
    const next = page < totalPages ? `<a class="button secondary" href="?page=${page + 1}">Nästa</a>` : "<span></span>";
  const tableBody = rows.length
    ? body
    : `<tr><td class="empty" colspan="${table.columns.length + 1}">Tabellen är tom.</td></tr>`;
  const content = `<div class="top"><div><h1>${escapeHtml(table.name)}</h1><div class="muted">${count} rader · ${table.columns.length} kolumner</div></div><a class="button" href="/tables/${urlPart(table.name)}/new">+ Ny rad</a></div><section class="card table-wrap"><table><thead><tr>${headers}<th>Åtgärd</th></tr></thead><tbody>${tableBody}</tbody></table><div class="pagination">${previous}<span class="muted">Sida ${page} av ${totalPages}</span>${next}</div></section>`;
    return layout(tables, table.name, table.name, content);
}

async function navigation(browser: BrowserService): Promise<string[]> {
    return browser.listTables();
}

export function createApp(browser: BrowserService): Express {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.urlencoded({extended: false, limit: "1mb"}));

    app.get("/", async (_req, res) => {
        const tables = await navigation(browser);
        if (tables[0]) return res.redirect(302, `/tables/${urlPart(tables[0])}`);
        return res.send(layout(tables, null, "Databas", '<div class="top"><div><h1>Databas</h1><div class="muted">Inga tabeller hittades i public-schemat.</div></div></div>'));
    });

    app.get("/tables/:table", async (req, res) => {
        const tableName = req.params.table;
        const page = Math.max(1, Number(req.query.page) || 1);
        const [tables, table, rows, count] = await Promise.all([
            navigation(browser),
            browser.describeTable(tableName),
            browser.listRows(tableName, page, 50),
            browser.countRows(tableName),
        ]);
        res.send(renderTablePage(tables, table, rows, count, page));
    });

    app.get("/tables/:table/new", async (req, res) => {
        const [tables, table] = await Promise.all([navigation(browser), browser.describeTable(req.params.table)]);
        const fields = table.columns.map((column) => field(column, undefined, true)).join("");
        const content = `<div class="top"><div><h1>Ny rad</h1><div class="muted">${escapeHtml(table.name)}</div></div></div><form class="card pad" method="post" action="/tables/${urlPart(table.name)}"><div class="form-grid">${fields}</div><div class="form-actions"><button type="submit">Skapa rad</button><a class="button secondary" href="/tables/${urlPart(table.name)}">Avbryt</a></div></form>`;
        res.send(layout(tables, table.name, "Ny rad", content));
    });

    app.post("/tables/:table", async (req, res) => {
        const table = await browser.describeTable(req.params.table);
        await browser.insertRow(table.name, formValues(req, table, true));
        res.redirect(303, `/tables/${urlPart(table.name)}`);
    });

    app.get("/tables/:table/rows/:key", async (req, res) => {
        const key = decodeKey(req.params.key);
        const [tables, table, row] = await Promise.all([
            navigation(browser),
            browser.describeTable(req.params.table),
            browser.getRow(req.params.table, key),
        ]);
        if (!row) return res.status(404).send(layout(tables, req.params.table, "Saknas", '<div class="notice">Raden hittades inte.</div>'));
        const fields = table.columns.map((column) => field(column, row[column.name], false)).join("");
        const action = `/tables/${urlPart(table.name)}/rows/${req.params.key}`;
        const content = `<div class="top"><div><h1>Redigera rad</h1><div class="muted">${escapeHtml(table.name)} · ${escapeHtml(JSON.stringify(key))}</div></div></div><form class="card pad" method="post" action="${action}"><div class="form-grid">${fields}</div><div class="form-actions"><button type="submit">Spara ändringar</button><a class="button secondary" href="/tables/${urlPart(table.name)}">Avbryt</a></div></form><section class="card danger-zone"><div class="pad"><div><h2>Radera rad</h2><div class="muted">Åtgärden går inte att ångra.</div></div><form method="post" action="${action}/delete"><button class="danger" type="submit">Radera permanent</button></form></div></section>`;
        return res.send(layout(tables, table.name, "Redigera rad", content));
    });

    app.post("/tables/:table/rows/:key", async (req, res) => {
        const table = await browser.describeTable(req.params.table);
        await browser.updateRow(table.name, decodeKey(req.params.key), formValues(req, table, false));
        res.redirect(303, `/tables/${urlPart(table.name)}`);
    });

    app.post("/tables/:table/rows/:key/delete", async (req, res) => {
        await browser.deleteRow(req.params.table, decodeKey(req.params.key));
        res.redirect(303, `/tables/${urlPart(req.params.table)}`);
    });

    app.use(async (error: unknown, req: Request, res: express.Response, _next: express.NextFunction) => {
        const message = error instanceof Error ? error.message : "Ett okänt fel inträffade.";
        let tables: string[] = [];
        try {
            tables = await navigation(browser);
        } catch {
            // Det ursprungliga databasfelet är mer relevant.
        }
        const activeTable = typeof req.params.table === "string" ? req.params.table : null;
        res.status(400).send(layout(tables, activeTable, "Fel", `<div class="top"><div><h1>Något gick fel</h1></div></div><div class="notice">${escapeHtml(message)}</div><a class="button secondary" href="/">Tillbaka</a>`));
    });

    return app;
}
