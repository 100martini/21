CREATE TABLE "Board" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Column" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "boardId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Column_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "columnId" INTEGER NOT NULL,
    "creatorId" INTEGER,
    "assigneeId" INTEGER,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Label" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_CardToLabel" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "Column_boardId_position_key" ON "Column"("boardId", "position");

CREATE UNIQUE INDEX "Card_columnId_position_key" ON "Card"("columnId", "position");

CREATE UNIQUE INDEX "_CardToLabel_AB_unique" ON "_CardToLabel"("A", "B");

CREATE INDEX "_CardToLabel_B_index" ON "_CardToLabel"("B");

ALTER TABLE "Board" ADD CONSTRAINT "Board_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Column" ADD CONSTRAINT "Column_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Card" ADD CONSTRAINT "Card_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Card" ADD CONSTRAINT "Card_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Card" ADD CONSTRAINT "Card_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_CardToLabel" ADD CONSTRAINT "_CardToLabel_A_fkey" FOREIGN KEY ("A") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CardToLabel" ADD CONSTRAINT "_CardToLabel_B_fkey" FOREIGN KEY ("B") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
