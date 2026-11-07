-- Each day's YouTube short, found by the morning cron (worker/shorts.ts) and matched to its day by publish time.
-- A row is never overwritten, so fixing a mis-matched day by hand sticks.
CREATE TABLE youtube_shorts (
  video_id TEXT PRIMARY KEY,
  day INTEGER NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT NOT NULL,
  found_at TEXT NOT NULL
);
