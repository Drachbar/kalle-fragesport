import { Store, type SessionData } from "express-session";
import { getDatabase, type Database } from "../db";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dagar

type SessionCallback = (err?: unknown) => void;
type GetCallback = (err: unknown, session?: SessionData | null) => void;

/**
 * express-session-store mot vår databasabstraktion och `session`-tabellen.
 */
export class DbSessionStore extends Store {
  private readonly db: Database;

  constructor(db: Database = getDatabase()) {
    super();
    this.db = db;
  }

  get(sid: string, callback: GetCallback): void {
    this.db
      .query<{ sess: SessionData }>(
        `SELECT sess FROM "session" WHERE sid = $1 AND expire > now()`,
        [sid],
      )
      .then((result) => callback(null, result.rows[0]?.sess ?? null))
      .catch((err) => callback(err));
  }

  set(sid: string, session: SessionData, callback?: SessionCallback): void {
    this.db
      .query(
        `INSERT INTO "session" (sid, sess, expire)
         VALUES ($1, $2::json, $3)
         ON CONFLICT (sid) DO UPDATE
           SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
        [sid, JSON.stringify(session), this.expiresAt(session)],
      )
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  destroy(sid: string, callback?: SessionCallback): void {
    this.db
      .query(`DELETE FROM "session" WHERE sid = $1`, [sid])
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  /**
   * Raderar alla sessioner som tillhör en användare (userId ligger i sess-JSON).
   * Med exceptSid behålls den angivna sessionen – användbart för att logga ut
   * alla *andra* enheter men behålla den nuvarande.
   */
  async destroyAllForUser(userId: string, exceptSid?: string): Promise<void> {
    if (exceptSid) {
      await this.db.query(
        `DELETE FROM "session" WHERE sess->>'userId' = $1 AND sid <> $2`,
        [userId, exceptSid],
      );
      return;
    }
    await this.db.query(`DELETE FROM "session" WHERE sess->>'userId' = $1`, [
      userId,
    ]);
  }

  touch(sid: string, session: SessionData, callback?: SessionCallback): void {
    this.db
      .query(`UPDATE "session" SET expire = $2 WHERE sid = $1`, [
        sid,
        this.expiresAt(session),
      ])
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  private expiresAt(session: SessionData): Date {
    const expires = session.cookie?.expires;
    return expires ? new Date(expires) : new Date(Date.now() + DEFAULT_TTL_MS);
  }
}
