-- Skickar endast jobb-id; varje API-pod läser den hållbara statusraden innan
-- den skickar status till sina lokalt anslutna WebSocket-klienter.
CREATE OR REPLACE FUNCTION notify_auto_update_job_status()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('auto_update_job_status', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_jobs_notify_status
AFTER INSERT OR UPDATE ON auto_update_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_auto_update_job_status();
