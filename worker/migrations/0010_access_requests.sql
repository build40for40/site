-- Requests for early access to an app built during the 40 days, such as Synergy, before it's public.
CREATE TABLE access_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES people (email),
  -- The app's slug, like "synergy"
  app TEXT NOT NULL,
  firm TEXT,
  note TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX access_requests_app ON access_requests (app, created_at);
