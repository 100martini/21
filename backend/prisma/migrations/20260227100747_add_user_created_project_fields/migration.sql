ALTER TABLE "Project" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isUserCreated" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Project_isUserCreated_idx" ON "Project"("isUserCreated");

CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;