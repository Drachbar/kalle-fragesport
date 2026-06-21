import { Pool } from "pg";
import { getDbConfig } from "./config";

/**
 * Delad anslutningspool för applikationens runtime-queries.
 * Återanvänds av repositories och av session-storen.
 */
export const pool = new Pool(getDbConfig());
