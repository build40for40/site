-- What the submitter signed up to when they sent the problem: "share" (they promised to tell three friends)
-- or "sponsor" (they picked an amount). Problems sent before this have neither.
ALTER TABLE problems ADD COLUMN backing TEXT;

-- The amount in cents picked with "sponsor", before anyone pays.
ALTER TABLE problems ADD COLUMN pledge INTEGER;

-- 1 if the submitter said we can contact them when their problem gets picked, 0 if not.
ALTER TABLE problems ADD COLUMN contact INTEGER;
