-- F1.11a — Add the `changes_requested` verification state. Kept in its own migration because
-- Postgres won't let a newly-added enum value be USED in the same transaction it's added — the
-- next migration (functions that reference the literal) runs in a separate transaction.
alter type public.tenant_verification add value if not exists 'changes_requested';
