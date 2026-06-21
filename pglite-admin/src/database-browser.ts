export interface QueryResult<T extends Record<string, unknown>> {
  rows: T[];
  affectedRows?: number;
}

export interface QueryExecutor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
}

export type Row = Record<string, unknown>;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function publicTable(table: string): string {
  return `${quoteIdentifier("public")}.${quoteIdentifier(table)}`;
}

function requireValues(values: Row, operation: string): [string, unknown][] {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    throw new Error(`${operation} kräver minst ett värde.`);
  }
  return entries;
}

function whereClause(key: Row, firstParameter: number): { sql: string; values: unknown[] } {
  const entries = Object.entries(key);
  if (entries.length === 0) {
    throw new Error("Kan inte ändra eller radera en rad utan primärnyckel.");
  }
  return {
    sql: entries
      .map(([column], index) => `${quoteIdentifier(column)} = $${firstParameter + index}`)
      .join(" AND "),
    values: entries.map(([, value]) => value),
  };
}

export class DatabaseBrowser {
  constructor(private readonly db: QueryExecutor) {}

  async listTables(): Promise<string[]> {
    const result = await this.db.query<{ name: string }>(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows.map(({ name }) => name);
  }

  async describeTable(name: string): Promise<TableInfo> {
    const columns = await this.db.query<{
      name: string;
      data_type: string;
      nullable: string;
      default_value: string | null;
    }>(
      `SELECT column_name AS name, data_type, is_nullable AS nullable,
              column_default AS default_value
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [name],
    );
    if (columns.rows.length === 0) {
      throw new Error(`Tabellen ${name} finns inte i public-schemat.`);
    }

    const primaryKey = await this.db.query<{ name: string }>(
      `SELECT kcu.column_name AS name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       WHERE tc.table_schema = 'public' AND tc.table_name = $1
         AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
      [name],
    );

    return {
      name,
      columns: columns.rows.map((column) => ({
        name: column.name,
        dataType: column.data_type,
        nullable: column.nullable === "YES",
        defaultValue: column.default_value,
      })),
      primaryKey: primaryKey.rows.map(({ name: columnName }) => columnName),
    };
  }

  async listRows(table: string, page: number, pageSize: number): Promise<Row[]> {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
    const result = await this.db.query(
      `SELECT * FROM ${publicTable(table)} LIMIT $1 OFFSET $2`,
      [safePageSize, (safePage - 1) * safePageSize],
    );
    return result.rows;
  }

  async countRows(table: string): Promise<number> {
    const result = await this.db.query<{ count: string | number }>(
      `SELECT count(*) AS count FROM ${publicTable(table)}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async getRow(table: string, key: Row): Promise<Row | null> {
    const where = whereClause(key, 1);
    const result = await this.db.query(
      `SELECT * FROM ${publicTable(table)} WHERE ${where.sql} LIMIT 1`,
      where.values,
    );
    return result.rows[0] ?? null;
  }

  async insertRow(table: string, values: Row): Promise<Row> {
    const entries = Object.entries(values);
    if (entries.length === 0) {
      const result = await this.db.query(
        `INSERT INTO ${publicTable(table)} DEFAULT VALUES RETURNING *`,
      );
      return result.rows[0] ?? {};
    }
    const columns = entries.map(([name]) => quoteIdentifier(name)).join(", ");
    const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
    const result = await this.db.query(
      `INSERT INTO ${publicTable(table)} (${columns}) VALUES (${placeholders}) RETURNING *`,
      entries.map(([, value]) => value),
    );
    return result.rows[0] ?? {};
  }

  async updateRow(table: string, key: Row, values: Row): Promise<Row> {
    const entries = requireValues(values, "UPDATE");
    const assignments = entries
      .map(([name], index) => `${quoteIdentifier(name)} = $${index + 1}`)
      .join(", ");
    const where = whereClause(key, entries.length + 1);
    const result = await this.db.query(
      `UPDATE ${publicTable(table)} SET ${assignments} WHERE ${where.sql} RETURNING *`,
      [...entries.map(([, value]) => value), ...where.values],
    );
    if (!result.rows[0]) throw new Error("Raden hittades inte.");
    return result.rows[0];
  }

  async deleteRow(table: string, key: Row): Promise<Row> {
    const where = whereClause(key, 1);
    const result = await this.db.query(
      `DELETE FROM ${publicTable(table)} WHERE ${where.sql} RETURNING *`,
      where.values,
    );
    if (!result.rows[0]) throw new Error("Raden hittades inte.");
    return result.rows[0];
  }
}
