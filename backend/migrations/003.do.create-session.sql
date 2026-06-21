-- Sessionstabell för connect-pg-simple (express-session-store).
-- Schemat följer connect-pg-simple/table.sql. Storen körs med
-- createTableIfMissing: false så att schemat ägs av den här migreringen.
CREATE TABLE "session" (
  "sid"    varchar      NOT NULL COLLATE "default",
  "sess"   json         NOT NULL,
  "expire" timestamp(6) NOT NULL
);

ALTER TABLE "session"
  ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
