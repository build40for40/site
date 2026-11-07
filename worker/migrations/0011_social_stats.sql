-- Social media and Substack stats, collected every day by the admin dashboard's Worker (build40for40/admin, worker/stats/).
-- The admin is the only thing that reads or writes these tables. The site never touches them.

-- One row per post per platform. `day` is the 40 for 40 day parsed from "Day N" in the caption,
-- or set by hand through /track. A later collect never overwrites a known day with null.
CREATE TABLE social_posts (
  platform TEXT NOT NULL,
  account TEXT NOT NULL,
  post_id TEXT NOT NULL,
  day INTEGER,
  caption TEXT,
  url TEXT,
  published_at TEXT,
  PRIMARY KEY (platform, post_id)
);
CREATE INDEX social_posts_day ON social_posts (day);

-- Metrics as they stood on one UK day. Collecting twice on the same day overwrites that day's row.
-- Counts are lifetime totals, so the day's growth is the difference from the previous row.
CREATE TABLE social_post_snapshots (
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  taken_on TEXT NOT NULL, -- YYYY-MM-DD, Europe/London
  taken_at TEXT NOT NULL, -- ISO timestamp, UTC
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  impressions INTEGER,
  watch_seconds INTEGER,
  extra TEXT, -- JSON of platform-specific numbers
  PRIMARY KEY (platform, post_id, taken_on)
);

CREATE TABLE social_account_snapshots (
  platform TEXT NOT NULL,
  account TEXT NOT NULL,
  taken_on TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  followers INTEGER, -- followers, subscribers or Substack subscribers
  extra TEXT,
  PRIMARY KEY (platform, account, taken_on)
);

-- OAuth tokens per connected account. Rotated refresh tokens are written back straight away.
CREATE TABLE social_tokens (
  platform TEXT NOT NULL,
  account TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  refresh_expires_at TEXT,
  scope TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (platform, account)
);

-- One row per source per account per collect, kept as a log.
CREATE TABLE social_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  ran_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  posts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  missing TEXT -- JSON array of secret names when the source isn't set up
);
CREATE INDEX social_runs_source ON social_runs (source, account, id);
