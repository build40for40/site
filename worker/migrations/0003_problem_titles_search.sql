-- A short title the team writes for each problem. Problems without one show the start of their text.
ALTER TABLE problems ADD COLUMN title TEXT;

-- Full-text index for /api/pool/search. It keeps its own copy of the text, keyed by problem id,
-- so it never depends on problems' rowids staying put.
CREATE VIRTUAL TABLE problems_fts USING fts5 (id UNINDEXED, title, problem, tokenize = 'porter unicode61 remove_diacritics 2');

INSERT INTO problems_fts (id, title, problem) SELECT id, title, problem FROM problems;

CREATE TRIGGER problems_fts_insert AFTER INSERT ON problems BEGIN
  INSERT INTO problems_fts (id, title, problem) VALUES (new.id, new.title, new.problem);
END;

CREATE TRIGGER problems_fts_update AFTER UPDATE OF title, problem ON problems BEGIN
  DELETE FROM problems_fts WHERE id = old.id;
  INSERT INTO problems_fts (id, title, problem) VALUES (new.id, new.title, new.problem);
END;

CREATE TRIGGER problems_fts_delete AFTER DELETE ON problems BEGIN
  DELETE FROM problems_fts WHERE id = old.id;
END;
