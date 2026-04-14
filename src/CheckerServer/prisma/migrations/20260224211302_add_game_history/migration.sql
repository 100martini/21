-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('TICTACTOE', 'CHECKERS');

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

-- CreateTable
CREATE TABLE "GameHistory" (
    "id" SERIAL NOT NULL,
    "gameType" "GameType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "result" "GameResult" NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
