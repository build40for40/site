-- How well each problem fits each category, from 0 to 1. Every category's score is kept, not only the ones the problem
-- landed in, so the thresholds in src/data/categories.ts can move without sorting everything again.
CREATE TABLE problem_categories (
  problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  score REAL NOT NULL,
  PRIMARY KEY (problem_id, category)
);

-- Who sorted the problem: the classifier's model name, or "team" when someone set its categories by hand, which the
-- classifier then leaves alone. Null until it's sorted.
ALTER TABLE problems ADD COLUMN categorised_by TEXT;

-- The CATEGORIES_VERSION it was sorted against. Older versions get sorted again.
ALTER TABLE problems ADD COLUMN categories_version INTEGER;

-- How likely it is to be a real problem someone could build an app for, from 0 to 1, to tell junk from problems that
-- just don't fit a category.
ALTER TABLE problems ADD COLUMN buildable REAL;
