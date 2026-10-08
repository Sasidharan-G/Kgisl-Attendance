-- Initial passwords (including ones published in the repository) must be replaced at first login.
ALTER TABLE "faculty" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "student" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- Every existing faculty and student account still uses an initial password.
UPDATE "faculty" SET "must_change_password" = true;
UPDATE "student" SET "must_change_password" = true;
