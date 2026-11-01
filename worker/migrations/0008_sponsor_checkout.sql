-- 1 while a problem sent with a sponsorship waits for its payment. It stays off the site until the payment lands, and
-- stays hidden for good if they never pay.
ALTER TABLE problems ADD COLUMN awaiting_payment INTEGER NOT NULL DEFAULT 0;

-- The guest day a payment sponsors, for payments that back a day rather than a problem.
ALTER TABLE payments ADD COLUMN day INTEGER;

-- The name the sponsor asked to be credited as. Null shows as Anonymous.
ALTER TABLE payments ADD COLUMN name TEXT;

CREATE INDEX payments_day ON payments (day);
