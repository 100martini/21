/*
  Warnings:

  - You are about to drop the column `opponent` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `GameHistory` table. All the data in the column will be lost.
  - Added the required column `player1` to the `GameHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `player2` to the `GameHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `winner` to the `GameHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GameHistory" DROP CONSTRAINT "GameHistory_username_fkey";

-- AlterTable
ALTER TABLE "GameHistory" DROP COLUMN "opponent",
DROP COLUMN "result",
DROP COLUMN "username",
ADD COLUMN     "player1" TEXT NOT NULL,
ADD COLUMN     "player2" TEXT NOT NULL,
ADD COLUMN     "winner" TEXT NOT NULL;
