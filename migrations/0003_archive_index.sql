CREATE INDEX essays_status_week_submitted_idx
ON essays(status, week_key DESC, submitted_at ASC);
