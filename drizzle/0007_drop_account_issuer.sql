-- Better Auth 1.7.3+ no longer writes accounts.issuer (added in 1.7.0-1.7.2), so
-- the NOT NULL column rejected every sign-up and account link. Accounts are
-- identified by (provider_id, account_id) again, as in 1.6. See
-- https://www.better-auth.com/docs/guides/1-7-upgrade-guide
DROP INDEX "accounts_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "issuer";