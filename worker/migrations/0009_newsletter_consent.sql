-- When someone first ticked the newsletter box on a form. Null means they never opted in.
ALTER TABLE people ADD COLUMN newsletter_at TEXT;
