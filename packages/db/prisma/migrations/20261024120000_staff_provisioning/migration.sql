-- P0-5 staff provisioning: the forced first-login password change needs a
-- per-user signal the server can enforce and only the server can clear.
ALTER TABLE "user" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
