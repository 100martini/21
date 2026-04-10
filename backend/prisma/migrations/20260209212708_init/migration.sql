CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "intraId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "avatar" TEXT,
    "campus" TEXT,
    "level" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wallet" INTEGER NOT NULL DEFAULT 0,
    "correctionPoints" INTEGER NOT NULL DEFAULT 0,
    "curriculum" TEXT NOT NULL DEFAULT 'old',
    "grade" TEXT NOT NULL DEFAULT 'Cadet',
    "currentCircle" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Curriculum" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "circle" INTEGER NOT NULL,
    "minTeam" INTEGER NOT NULL DEFAULT 1,
    "maxTeam" INTEGER NOT NULL DEFAULT 1,
    "isOuterCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCurriculum" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "curriculumId" INTEGER NOT NULL,
    CONSTRAINT "ProjectCurriculum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProject" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "finalMark" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_intraId_key" ON "User"("intraId");
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");
CREATE INDEX "User_intraId_idx" ON "User"("intraId");
CREATE INDEX "User_login_idx" ON "User"("login");
CREATE INDEX "User_curriculum_idx" ON "User"("curriculum");
CREATE UNIQUE INDEX "Curriculum_name_key" ON "Curriculum"("name");
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_slug_idx" ON "Project"("slug");
CREATE INDEX "Project_circle_idx" ON "Project"("circle");
CREATE INDEX "Project_isOuterCore_idx" ON "Project"("isOuterCore");
CREATE INDEX "ProjectCurriculum_projectId_idx" ON "ProjectCurriculum"("projectId");
CREATE INDEX "ProjectCurriculum_curriculumId_idx" ON "ProjectCurriculum"("curriculumId");
CREATE UNIQUE INDEX "ProjectCurriculum_projectId_curriculumId_key" ON "ProjectCurriculum"("projectId", "curriculumId");
CREATE INDEX "Team_projectId_idx" ON "Team"("projectId");
CREATE INDEX "Team_creatorId_idx" ON "Team"("creatorId");
CREATE INDEX "Team_status_idx" ON "Team"("status");
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
CREATE INDEX "TeamMember_status_idx" ON "TeamMember"("status");
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX "UserProject_userId_idx" ON "UserProject"("userId");
CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");
CREATE UNIQUE INDEX "UserProject_userId_projectId_key" ON "UserProject"("userId", "projectId");

ALTER TABLE "ProjectCurriculum" ADD CONSTRAINT "ProjectCurriculum_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCurriculum" ADD CONSTRAINT "ProjectCurriculum_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;