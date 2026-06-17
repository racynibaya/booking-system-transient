-- F1.4 — Guest deposit: add the 'awaiting_confirmation' lifecycle state.
--
-- A held booking moves to 'awaiting_confirmation' once the guest uploads payment proof:
-- it still occupies inventory, but has no hold_expires_at (sweep-exempt) and waits for the
-- operator to confirm. Isolated in its own migration because Postgres forbids using a new
-- enum value in the same transaction that adds it (ALTER TYPE ... ADD VALUE must commit
-- first); the functions that reference it live in the next migration.
alter type public.booking_status add value if not exists 'awaiting_confirmation' after 'held';
