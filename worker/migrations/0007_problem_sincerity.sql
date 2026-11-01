-- The classifier now asks whether a problem is meant sincerely, rather than whether it could be built, to tell junk from
-- problems that just don't fit a category. Nothing had been sorted when this changed, so the column holds no old answers.
ALTER TABLE problems RENAME COLUMN buildable TO sincere;
