CREATE TABLE people (
  email TEXT PRIMARY KEY,
  name TEXT,
  -- JSON array of involvement values from src/data/site.ts
  involved TEXT,
  -- The amount in pence picked on the join form, before checkout
  sponsor INTEGER,
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES people (email),
  problem TEXT NOT NULL,
  affects TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX problems_email ON problems (email);

-- One row per completed Stripe Checkout Session. The email is whatever the payer typed at checkout,
-- so it isn't tied to people.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  email TEXT,
  problem_id TEXT REFERENCES problems (id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  livemode INTEGER NOT NULL,
  paid_at TEXT NOT NULL
) STRICT;

CREATE INDEX payments_email ON payments (email);
CREATE INDEX payments_problem_id ON payments (problem_id);
