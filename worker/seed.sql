-- Obviously fake rows for local development. Apply with npm run db:seed.
-- Re-running it is safe: rows that already exist are left alone, and the fake payments are replaced so changed amounts
-- take effect. The first 34 problems raise enough to fill every day, 35 to 41 spill into the pool at $4 and 40¢, and
-- the rest are at $0.

DELETE FROM payments WHERE id LIKE 'cs_test_seed_%';
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed01@example.com', 'Maia Example', '2026-10-01T09:00:00.000Z', '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-01', 'seed01@example.com', 'Fifteen people, one meeting, nobody listening. Turn updates into a two-minute digest.', 'Endless standups', '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_01_1', NULL, 'seed-problem-01', 52600, 'usd', 0, '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_01_2', NULL, 'seed-problem-01', 26300, 'usd', 0, '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_01_3', NULL, 'seed-problem-01', 17500, 'usd', 0, '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_01_4', NULL, 'seed-problem-01', 13100, 'usd', 0, '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_01_5', NULL, 'seed-problem-01', 10500, 'usd', 0, '2026-10-01T09:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed02@example.com', 'Rohan Example', '2026-10-01T09:01:00.000Z', '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-02', 'seed02@example.com', 'Photograph a parking sign and get a plain yes or no on whether you can park there right now.', 'Parking ticket dread', '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_1', NULL, 'seed-problem-02', 32700, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_2', NULL, 'seed-problem-02', 16400, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_3', NULL, 'seed-problem-02', 10900, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_4', NULL, 'seed-problem-02', 8200, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_5', NULL, 'seed-problem-02', 6600, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_6', NULL, 'seed-problem-02', 5500, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_02_7', NULL, 'seed-problem-02', 4700, 'usd', 0, '2026-10-01T09:01:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed03@example.com', 'Priya Example', '2026-10-01T09:02:00.000Z', '2026-10-01T09:02:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-03', 'seed03@example.com', 'Find the 400 near-identical shots of the same sunset and keep the best one.', 'Duplicate photos', '2026-10-01T09:02:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_03_1', NULL, 'seed-problem-03', 32700, 'usd', 0, '2026-10-01T09:02:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_03_2', NULL, 'seed-problem-03', 16400, 'usd', 0, '2026-10-01T09:02:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_03_3', NULL, 'seed-problem-03', 10900, 'usd', 0, '2026-10-01T09:02:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed04@example.com', NULL, '2026-10-01T09:03:00.000Z', '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-04', 'seed04@example.com', 'Every library card in the house in one place, with a nudge before the fines start.', NULL, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_1', NULL, 'seed-problem-04', 14900, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_2', NULL, 'seed-problem-04', 7400, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_3', NULL, 'seed-problem-04', 4900, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_4', NULL, 'seed-problem-04', 3700, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_5', NULL, 'seed-problem-04', 3000, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_6', NULL, 'seed-problem-04', 2500, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_7', NULL, 'seed-problem-04', 2100, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_8', NULL, 'seed-problem-04', 1900, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_04_9', NULL, 'seed-problem-04', 1600, 'usd', 0, '2026-10-01T09:03:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed05@example.com', 'Lena Example', '2026-10-01T09:04:00.000Z', '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-05', 'seed05@example.com', 'Catch up on 300 unread messages with a summary of the bits that actually need you.', 'Noisy group chats', '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_05_1', NULL, 'seed-problem-05', 13100, 'usd', 0, '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_05_2', NULL, 'seed-problem-05', 6600, 'usd', 0, '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_05_3', NULL, 'seed-problem-05', 4400, 'usd', 0, '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_05_4', NULL, 'seed-problem-05', 3300, 'usd', 0, '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_05_5', NULL, 'seed-problem-05', 2600, 'usd', 0, '2026-10-01T09:04:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed06@example.com', 'Sam Example', '2026-10-01T09:05:00.000Z', '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-06', 'seed06@example.com', 'Forward the confirmation email and it builds the pipeline for you.', 'Tracking job applications', '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_06_1', NULL, 'seed-problem-06', 11000, 'usd', 0, '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_06_2', NULL, 'seed-problem-06', 5500, 'usd', 0, '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_06_3', NULL, 'seed-problem-06', 3600, 'usd', 0, '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_06_4', NULL, 'seed-problem-06', 2700, 'usd', 0, '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_06_5', NULL, 'seed-problem-06', 2200, 'usd', 0, '2026-10-01T09:05:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed07@example.com', 'Tom Example', '2026-10-01T09:06:00.000Z', '2026-10-01T09:06:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-07', 'seed07@example.com', 'A screen time deal the whole family can see and nobody can fudge.', 'Kids'' screen time', '2026-10-01T09:06:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_07_1', NULL, 'seed-problem-07', 12000, 'usd', 0, '2026-10-01T09:06:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_07_2', NULL, 'seed-problem-07', 6000, 'usd', 0, '2026-10-01T09:06:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed08@example.com', NULL, '2026-10-01T09:07:00.000Z', '2026-10-01T09:07:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-08', 'seed08@example.com', 'Somewhere nearby with wifi, a socket and no blender for the next hour.', NULL, '2026-10-01T09:07:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_08_1', NULL, 'seed-problem-08', 6500, 'usd', 0, '2026-10-01T09:07:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_08_2', NULL, 'seed-problem-08', 3300, 'usd', 0, '2026-10-01T09:07:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_08_3', NULL, 'seed-problem-08', 2200, 'usd', 0, '2026-10-01T09:07:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed09@example.com', 'Ayesha Example', '2026-10-01T09:08:00.000Z', '2026-10-01T09:08:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-09', 'seed09@example.com', 'Tell it who they are and your budget, get three gifts you can buy before 18:00.', 'Last-minute gifts', '2026-10-01T09:08:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_09_1', NULL, 'seed-problem-09', 10000, 'usd', 0, '2026-10-01T09:08:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed10@example.com', 'Dan Example', '2026-10-01T09:09:00.000Z', '2026-10-01T09:09:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-10', 'seed10@example.com', 'A chore rota for flatmates that remembers who actually did the bins.', 'Shared chore rotas', '2026-10-01T09:09:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_10_1', NULL, 'seed-problem-10', 2900, 'usd', 0, '2026-10-01T09:09:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_10_2', NULL, 'seed-problem-10', 1400, 'usd', 0, '2026-10-01T09:09:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_10_3', NULL, 'seed-problem-10', 1000, 'usd', 0, '2026-10-01T09:09:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_10_4', NULL, 'seed-problem-10', 700, 'usd', 0, '2026-10-01T09:09:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed11@example.com', 'Maia Example', '2026-10-01T09:10:00.000Z', '2026-10-01T09:10:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-11', 'seed11@example.com', 'Birthdays from every app in one feed, with a reminder a week early.', 'Forgotten birthdays', '2026-10-01T09:10:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_11_1', NULL, 'seed-problem-11', 2700, 'usd', 0, '2026-10-01T09:10:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_11_2', NULL, 'seed-problem-11', 1300, 'usd', 0, '2026-10-01T09:10:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed12@example.com', 'Rohan Example', '2026-10-01T09:11:00.000Z', '2026-10-01T09:11:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-12', 'seed12@example.com', 'Polite, then less polite, reminders for freelancers who''d rather not.', NULL, '2026-10-01T09:11:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_12_1', NULL, 'seed-problem-12', 2500, 'usd', 0, '2026-10-01T09:11:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed13@example.com', 'Priya Example', '2026-10-01T09:12:00.000Z', '2026-10-01T09:12:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-13', 'seed13@example.com', 'Point your camera at a wall and try twenty colours before buying a tester pot.', 'Picking a paint colour', '2026-10-01T09:12:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_13_1', NULL, 'seed-problem-13', 1300, 'usd', 0, '2026-10-01T09:12:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_13_2', NULL, 'seed-problem-13', 700, 'usd', 0, '2026-10-01T09:12:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed14@example.com', NULL, '2026-10-01T09:13:00.000Z', '2026-10-01T09:13:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-14', 'seed14@example.com', 'Photograph the receipt, tap what you had, everyone gets a payment link.', 'Splitting the bill', '2026-10-01T09:13:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_14_1', NULL, 'seed-problem-14', 1500, 'usd', 0, '2026-10-01T09:13:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed15@example.com', 'Lena Example', '2026-10-01T09:14:00.000Z', '2026-10-01T09:14:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-15', 'seed15@example.com', 'Turn meeting notes into the three actions people actually need.', 'Notes nobody reads', '2026-10-01T09:14:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_15_1', NULL, 'seed-problem-15', 800, 'usd', 0, '2026-10-01T09:14:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_15_2', NULL, 'seed-problem-15', 400, 'usd', 0, '2026-10-01T09:14:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed16@example.com', 'Sam Example', '2026-10-01T09:15:00.000Z', '2026-10-01T09:15:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-16', 'seed16@example.com', 'A QR code for guests so nobody reads the router upside down again.', NULL, '2026-10-01T09:15:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_16_1', NULL, 'seed-problem-16', 1000, 'usd', 0, '2026-10-01T09:15:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed17@example.com', 'Tom Example', '2026-10-01T09:16:00.000Z', '2026-10-01T09:16:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-17', 'seed17@example.com', 'Say how long your commute is, get one episode that fits it exactly.', 'Choosing a podcast', '2026-10-01T09:16:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_17_1', NULL, 'seed-problem-17', 1000, 'usd', 0, '2026-10-01T09:16:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed18@example.com', NULL, '2026-10-01T09:17:00.000Z', '2026-10-01T09:17:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-18', 'seed18@example.com', 'Every account to update when you move, as one checklist.', 'Moving house', '2026-10-01T09:17:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_18_1', NULL, 'seed-problem-18', 900, 'usd', 0, '2026-10-01T09:17:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed19@example.com', 'Ayesha Example', '2026-10-01T09:18:00.000Z', '2026-10-01T09:18:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-19', 'seed19@example.com', 'See which neighbour has a drill before you buy a third one.', 'Borrowing tools', '2026-10-01T09:18:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_19_1', NULL, 'seed-problem-19', 900, 'usd', 0, '2026-10-01T09:18:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed20@example.com', 'Dan Example', '2026-10-01T09:19:00.000Z', '2026-10-01T09:19:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-20', 'seed20@example.com', 'One weekly digest of the newsletters you meant to read.', NULL, '2026-10-01T09:19:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_20_1', NULL, 'seed-problem-20', 800, 'usd', 0, '2026-10-01T09:19:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed21@example.com', 'Maia Example', '2026-10-01T09:20:00.000Z', '2026-10-01T09:20:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-21', 'seed21@example.com', 'Shared reminders so the dog doesn''t get its pill twice.', 'Pet medication', '2026-10-01T09:20:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_21_1', NULL, 'seed-problem-21', 800, 'usd', 0, '2026-10-01T09:20:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed22@example.com', 'Rohan Example', '2026-10-01T09:21:00.000Z', '2026-10-01T09:21:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-22', 'seed22@example.com', 'Find a free tennis court near you without opening six council websites.', 'Booking a court', '2026-10-01T09:21:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_22_1', NULL, 'seed-problem-22', 800, 'usd', 0, '2026-10-01T09:21:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed23@example.com', 'Priya Example', '2026-10-01T09:22:00.000Z', '2026-10-01T09:22:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-23', 'seed23@example.com', 'Every voucher and code in one list, sorted by when it dies.', 'Expiring coupons', '2026-10-01T09:22:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_23_1', NULL, 'seed-problem-23', 700, 'usd', 0, '2026-10-01T09:22:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed24@example.com', NULL, '2026-10-01T09:23:00.000Z', '2026-10-01T09:23:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-24', 'seed24@example.com', 'A habit tracker that forgives you for missing a day.', NULL, '2026-10-01T09:23:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_24_1', NULL, 'seed-problem-24', 700, 'usd', 0, '2026-10-01T09:23:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed25@example.com', 'Lena Example', '2026-10-01T09:24:00.000Z', '2026-10-01T09:24:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-25', 'seed25@example.com', 'MOT, tax and service dates for your car, nudged at the right time.', 'Car maintenance', '2026-10-01T09:24:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_25_1', NULL, 'seed-problem-25', 700, 'usd', 0, '2026-10-01T09:24:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed26@example.com', 'Sam Example', '2026-10-01T09:25:00.000Z', '2026-10-01T09:25:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-26', 'seed26@example.com', 'Match with someone learning your language who speaks the one you want.', 'Language partners', '2026-10-01T09:25:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_26_1', NULL, 'seed-problem-26', 600, 'usd', 0, '2026-10-01T09:25:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed27@example.com', 'Tom Example', '2026-10-01T09:26:00.000Z', '2026-10-01T09:26:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-27', 'seed27@example.com', 'Stop five people bringing hummus.', 'Potluck planning', '2026-10-01T09:26:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_27_1', NULL, 'seed-problem-27', 600, 'usd', 0, '2026-10-01T09:26:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed28@example.com', NULL, '2026-10-01T09:27:00.000Z', '2026-10-01T09:27:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-28', 'seed28@example.com', 'What to sow this week for your postcode.', NULL, '2026-10-01T09:27:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_28_1', NULL, 'seed-problem-28', 600, 'usd', 0, '2026-10-01T09:27:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed29@example.com', 'Ayesha Example', '2026-10-01T09:28:00.000Z', '2026-10-01T09:28:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-29', 'seed29@example.com', 'A playlist exactly as long as today''s train.', 'Commute playlists', '2026-10-01T09:28:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_29_1', NULL, 'seed-problem-29', 600, 'usd', 0, '2026-10-01T09:28:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed30@example.com', 'Dan Example', '2026-10-01T09:29:00.000Z', '2026-10-01T09:29:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-30', 'seed30@example.com', 'Swap shifts with coworkers without the 40-message group chat.', 'Shift swaps', '2026-10-01T09:29:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_30_1', NULL, 'seed-problem-30', 500, 'usd', 0, '2026-10-01T09:29:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed31@example.com', 'Maia Example', '2026-10-01T09:30:00.000Z', '2026-10-01T09:30:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-31', 'seed31@example.com', 'Pair every lonely sock in the house with a photo and a bit of maths.', 'Sock drawer chaos', '2026-10-01T09:30:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_31_1', NULL, 'seed-problem-31', 500, 'usd', 0, '2026-10-01T09:30:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed32@example.com', 'Rohan Example', '2026-10-01T09:31:00.000Z', '2026-10-01T09:31:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-32', 'seed32@example.com', 'Trade cuttings with people on your street instead of buying new plants.', NULL, '2026-10-01T09:31:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_32_1', NULL, 'seed-problem-32', 500, 'usd', 0, '2026-10-01T09:31:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed33@example.com', 'Priya Example', '2026-10-01T09:32:00.000Z', '2026-10-01T09:32:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-33', 'seed33@example.com', 'Tell it the weather and your kids'' ages, get three things to do indoors.', 'Rainy day plans', '2026-10-01T09:32:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_33_1', NULL, 'seed-problem-33', 500, 'usd', 0, '2026-10-01T09:32:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed34@example.com', NULL, '2026-10-01T09:33:00.000Z', '2026-10-01T09:33:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-34', 'seed34@example.com', 'Which bin goes out tonight, answered with one tap.', 'Bin day confusion', '2026-10-01T09:33:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_34_1', NULL, 'seed-problem-34', 500, 'usd', 0, '2026-10-01T09:33:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed35@example.com', 'Lena Example', '2026-10-01T09:34:00.000Z', '2026-10-01T09:34:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-35', 'seed35@example.com', 'Get pinged the second a spot opens in the class you missed.', 'Gym class waitlists', '2026-10-01T09:34:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_35_1', NULL, 'seed-problem-35', 400, 'usd', 0, '2026-10-01T09:34:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed36@example.com', 'Sam Example', '2026-10-01T09:35:00.000Z', '2026-10-01T09:35:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-36', 'seed36@example.com', 'Turn a recipe for four into one for eleven without the fractions meltdown.', NULL, '2026-10-01T09:35:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_36_1', NULL, 'seed-problem-36', 400, 'usd', 0, '2026-10-01T09:35:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed37@example.com', 'Tom Example', '2026-10-01T09:36:00.000Z', '2026-10-01T09:36:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-37', 'seed37@example.com', 'Know if your train is late before you leave the house.', 'Commute delays', '2026-10-01T09:36:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_37_1', NULL, 'seed-problem-37', 400, 'usd', 0, '2026-10-01T09:36:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed38@example.com', NULL, '2026-10-01T09:37:00.000Z', '2026-10-01T09:37:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-38', 'seed38@example.com', 'A cheap tag and a map of where you last had them.', 'Lost keys', '2026-10-01T09:37:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_38_1', NULL, 'seed-problem-38', 400, 'usd', 0, '2026-10-01T09:37:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed39@example.com', 'Ayesha Example', '2026-10-01T09:38:00.000Z', '2026-10-01T09:38:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-39', 'seed39@example.com', 'Let the whole office vote on the thermostat and settle it fairly.', 'Office temperature wars', '2026-10-01T09:38:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_39_1', NULL, 'seed-problem-39', 40, 'usd', 0, '2026-10-01T09:38:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed40@example.com', 'Dan Example', '2026-10-01T09:39:00.000Z', '2026-10-01T09:39:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-40', 'seed40@example.com', 'Sign up for the charity shop shift without the spreadsheet.', NULL, '2026-10-01T09:39:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_40_1', NULL, 'seed-problem-40', 40, 'usd', 0, '2026-10-01T09:39:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed41@example.com', 'Maia Example', '2026-10-01T09:40:00.000Z', '2026-10-01T09:40:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-41', 'seed41@example.com', 'One list the whole house can add to while you''re in the shop.', 'Grocery list sharing', '2026-10-01T09:40:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO payments (id, email, problem_id, amount, currency, livemode, paid_at) VALUES ('cs_test_seed_41_1', NULL, 'seed-problem-41', 40, 'usd', 0, '2026-10-01T09:40:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed42@example.com', 'Rohan Example', '2026-10-01T09:41:00.000Z', '2026-10-01T09:41:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-42', 'seed42@example.com', 'Find out where you are on every allotment list at once.', 'Allotment waiting lists', '2026-10-01T09:41:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed43@example.com', 'Priya Example', '2026-10-01T09:42:00.000Z', '2026-10-01T09:42:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-43', 'seed43@example.com', 'Chase the last ten RSVPs without a single awkward text.', 'Wedding RSVPs', '2026-10-01T09:42:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed44@example.com', NULL, '2026-10-01T09:43:00.000Z', '2026-10-01T09:43:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-44', 'seed44@example.com', 'Invite the whole class and track who''s coming, allergies included.', NULL, '2026-10-01T09:43:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed45@example.com', 'Lena Example', '2026-10-01T09:44:00.000Z', '2026-10-01T09:44:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-45', 'seed45@example.com', 'Plan who bakes what so you don''t end up with forty brownies.', 'Charity bake sales', '2026-10-01T09:44:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed46@example.com', 'Sam Example', '2026-10-01T09:45:00.000Z', '2026-10-01T09:45:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-46', 'seed46@example.com', 'Book the rehearsal room around five drummers'' diaries.', 'Band practice slots', '2026-10-01T09:45:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed47@example.com', 'Tom Example', '2026-10-01T09:46:00.000Z', '2026-10-01T09:46:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-47', 'seed47@example.com', 'Pick next month''s book without a three-week debate.', 'Book club picks', '2026-10-01T09:46:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed48@example.com', NULL, '2026-10-01T09:47:00.000Z', '2026-10-01T09:47:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-48', 'seed48@example.com', 'A new 5k loop from your door every week.', NULL, '2026-10-01T09:47:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed49@example.com', 'Ayesha Example', '2026-10-01T09:48:00.000Z', '2026-10-01T09:48:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-49', 'seed49@example.com', 'Share dog walks with neighbours when you''re stuck at work.', 'Dog walking swaps', '2026-10-01T09:48:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed50@example.com', 'Dan Example', '2026-10-01T09:49:00.000Z', '2026-10-01T09:49:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-50', 'seed50@example.com', 'Nudges to drink water that adapt to how hot it is.', 'Water reminders', '2026-10-01T09:49:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed51@example.com', 'Maia Example', '2026-10-01T09:50:00.000Z', '2026-10-01T09:50:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-51', 'seed51@example.com', 'Get told when a charity shop near you gets your size in.', 'Thrift finds', '2026-10-01T09:50:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed52@example.com', 'Rohan Example', '2026-10-01T09:51:00.000Z', '2026-10-01T09:51:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-52', 'seed52@example.com', 'A week view of every child''s homework, due dates first.', NULL, '2026-10-01T09:51:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed53@example.com', 'Priya Example', '2026-10-01T09:52:00.000Z', '2026-10-01T09:52:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-53', 'seed53@example.com', 'Pick a game everyone can learn in ten minutes.', 'Board game nights', '2026-10-01T09:52:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed54@example.com', NULL, '2026-10-01T09:53:00.000Z', '2026-10-01T09:53:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-54', 'seed54@example.com', 'Rate flats on the spot and compare them later.', 'Flat viewing notes', '2026-10-01T09:53:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed55@example.com', 'Lena Example', '2026-10-01T09:54:00.000Z', '2026-10-01T09:54:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-55', 'seed55@example.com', 'Find someone nearby who can fix your toaster this weekend.', 'Repair cafés', '2026-10-01T09:54:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO people (email, name, joined_at, updated_at) VALUES ('seed56@example.com', 'Sam Example', '2026-10-01T09:55:00.000Z', '2026-10-01T09:55:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO problems (id, email, problem, title, created_at) VALUES ('seed-problem-56', 'seed56@example.com', 'Give away tonight''s leftovers to someone on your street.', NULL, '2026-10-01T09:55:00.000Z') ON CONFLICT DO NOTHING;

-- Sorted by hand as if by the team, so the topic chips work without a TypeSafe key. The last two are left unsorted.
INSERT INTO problem_categories (problem_id, category, score) VALUES
  ('seed-problem-01', 'work', 1),
  ('seed-problem-02', 'travel', 1),
  ('seed-problem-03', 'admin', 1),
  ('seed-problem-04', 'admin', 1),
  ('seed-problem-05', 'community', 1),
  ('seed-problem-06', 'work', 1),
  ('seed-problem-07', 'kids', 1),
  ('seed-problem-08', 'work', 1),
  ('seed-problem-09', 'community', 1),
  ('seed-problem-10', 'home', 1),
  ('seed-problem-11', 'community', 1),
  ('seed-problem-11', 'admin', 1),
  ('seed-problem-12', 'work', 1),
  ('seed-problem-12', 'finance', 1),
  ('seed-problem-13', 'home', 1),
  ('seed-problem-14', 'finance', 1),
  ('seed-problem-14', 'community', 1),
  ('seed-problem-15', 'work', 1),
  ('seed-problem-16', 'home', 1),
  ('seed-problem-17', 'fun', 1),
  ('seed-problem-17', 'travel', 1),
  ('seed-problem-18', 'admin', 1),
  ('seed-problem-18', 'home', 1),
  ('seed-problem-19', 'community', 1),
  ('seed-problem-19', 'home', 1),
  ('seed-problem-20', 'admin', 1),
  ('seed-problem-21', 'home', 1),
  ('seed-problem-22', 'health', 1),
  ('seed-problem-23', 'finance', 1),
  ('seed-problem-24', 'mind', 1),
  ('seed-problem-24', 'work', 1),
  ('seed-problem-25', 'travel', 1),
  ('seed-problem-25', 'admin', 1),
  ('seed-problem-26', 'learning', 1),
  ('seed-problem-27', 'community', 1),
  ('seed-problem-27', 'food', 1),
  ('seed-problem-28', 'home', 1),
  ('seed-problem-29', 'fun', 1),
  ('seed-problem-30', 'work', 1),
  ('seed-problem-32', 'community', 1),
  ('seed-problem-32', 'home', 1),
  ('seed-problem-33', 'kids', 1),
  ('seed-problem-34', 'home', 1),
  ('seed-problem-35', 'health', 1),
  ('seed-problem-36', 'food', 1),
  ('seed-problem-37', 'travel', 1),
  ('seed-problem-38', 'home', 1),
  ('seed-problem-39', 'work', 1),
  ('seed-problem-40', 'community', 1),
  ('seed-problem-41', 'home', 1),
  ('seed-problem-41', 'food', 1),
  ('seed-problem-42', 'home', 1),
  ('seed-problem-42', 'community', 1),
  ('seed-problem-43', 'community', 1),
  ('seed-problem-44', 'kids', 1),
  ('seed-problem-44', 'community', 1),
  ('seed-problem-45', 'community', 1),
  ('seed-problem-45', 'food', 1),
  ('seed-problem-46', 'fun', 1),
  ('seed-problem-47', 'fun', 1),
  ('seed-problem-48', 'health', 1),
  ('seed-problem-49', 'community', 1),
  ('seed-problem-49', 'home', 1),
  ('seed-problem-50', 'health', 1),
  ('seed-problem-51', 'finance', 1),
  ('seed-problem-52', 'kids', 1),
  ('seed-problem-53', 'fun', 1),
  ('seed-problem-54', 'home', 1)
ON CONFLICT DO NOTHING;
UPDATE problems SET categorised_by = 'team', categories_version = 1 WHERE categorised_by IS NULL AND id IN ('seed-problem-01', 'seed-problem-02', 'seed-problem-03', 'seed-problem-04', 'seed-problem-05', 'seed-problem-06', 'seed-problem-07', 'seed-problem-08', 'seed-problem-09', 'seed-problem-10', 'seed-problem-11', 'seed-problem-12', 'seed-problem-13', 'seed-problem-14', 'seed-problem-15', 'seed-problem-16', 'seed-problem-17', 'seed-problem-18', 'seed-problem-19', 'seed-problem-20', 'seed-problem-21', 'seed-problem-22', 'seed-problem-23', 'seed-problem-24', 'seed-problem-25', 'seed-problem-26', 'seed-problem-27', 'seed-problem-28', 'seed-problem-29', 'seed-problem-30', 'seed-problem-31', 'seed-problem-32', 'seed-problem-33', 'seed-problem-34', 'seed-problem-35', 'seed-problem-36', 'seed-problem-37', 'seed-problem-38', 'seed-problem-39', 'seed-problem-40', 'seed-problem-41', 'seed-problem-42', 'seed-problem-43', 'seed-problem-44', 'seed-problem-45', 'seed-problem-46', 'seed-problem-47', 'seed-problem-48', 'seed-problem-49', 'seed-problem-50', 'seed-problem-51', 'seed-problem-52', 'seed-problem-53', 'seed-problem-54');
