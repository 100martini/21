-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tictactoePlayed" INTEGER NOT NULL DEFAULT 0,
    "tictactoeWins" INTEGER NOT NULL DEFAULT 0,
    "tictactoeLosses" INTEGER NOT NULL DEFAULT 0,
    "tictactoeDraws" INTEGER NOT NULL DEFAULT 0,
    "checkersPlayed" INTEGER NOT NULL DEFAULT 0,
    "checkersWins" INTEGER NOT NULL DEFAULT 0,
    "checkersLosses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
