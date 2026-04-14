CREATE TABLE "DeleteRequest" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeleteRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeleteApproval" (
    "id" SERIAL NOT NULL,
    "deleteRequestId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeleteApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeleteRequest_teamId_key" ON "DeleteRequest"("teamId");
CREATE INDEX "DeleteRequest_teamId_idx" ON "DeleteRequest"("teamId");
CREATE INDEX "DeleteRequest_requesterId_idx" ON "DeleteRequest"("requesterId");
CREATE INDEX "DeleteRequest_status_idx" ON "DeleteRequest"("status");
CREATE INDEX "DeleteApproval_deleteRequestId_idx" ON "DeleteApproval"("deleteRequestId");
CREATE INDEX "DeleteApproval_userId_idx" ON "DeleteApproval"("userId");
CREATE UNIQUE INDEX "DeleteApproval_deleteRequestId_userId_key" ON "DeleteApproval"("deleteRequestId", "userId");

ALTER TABLE "DeleteRequest" ADD CONSTRAINT "DeleteRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeleteRequest" ADD CONSTRAINT "DeleteRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeleteApproval" ADD CONSTRAINT "DeleteApproval_deleteRequestId_fkey" FOREIGN KEY ("deleteRequestId") REFERENCES "DeleteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeleteApproval" ADD CONSTRAINT "DeleteApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;