ALTER TABLE "student" ADD COLUMN "reg_no" TEXT NOT NULL;
CREATE UNIQUE INDEX "student_reg_no_key" ON "student"("reg_no");
