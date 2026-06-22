-- Per-användare OpenAI-nyckel, krypterad i app-lagret (AES-256-GCM).
-- Egen tabell så hemligheten hålls skild från users (returneras aldrig av
-- användar-repot). En rad per användare (PK = user_id).
CREATE TABLE user_openai_keys (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_key TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Återanvänder set_updated_at() från migrering 001.
CREATE TRIGGER user_openai_keys_set_updated_at
  BEFORE UPDATE ON user_openai_keys
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
