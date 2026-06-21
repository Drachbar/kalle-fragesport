-- Sessionstabell för express-session (egen DbSessionStore).
-- expire som timestamptz för entydig jämförelse mot now() i båda drivrutinerna.
CREATE TABLE "session" (
  "sid"    varchar     NOT NULL COLLATE "default",
  "sess"   json        NOT NULL,
  "expire" timestamptz NOT NULL
);

ALTER TABLE "session"
  ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
