CREATE TABLE help_offers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES people (email),
  company TEXT,
  type TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX help_offers_email ON help_offers (email);

CREATE TABLE guest_applications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES people (email),
  role TEXT NOT NULL,
  nominated_by TEXT,
  bring TEXT NOT NULL,
  -- JSON array of weeks, like ["week-1","week-3"]
  availability TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX guest_applications_email ON guest_applications (email);
