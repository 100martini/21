/*
  Warnings:

  - You are about to drop the column `userId` on the `GameHistory` table. All the data in the column will be lost.
  - Added the required column `username` to the `GameHistory` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `gameType` on the `GameHistory` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `result` on the `GameHistory` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "GameHistory" DROP CONSTRAINT "GameHistory_userId_fkey";

-- AlterTable
ALTER TABLE "GameHistory" DROP COLUMN "userId",
ADD COLUMN     "username" TEXT NOT NULL,
DROP COLUMN "gameType",
ADD COLUMN     "gameType" TEXT NOT NULL,
DROP COLUMN "result",
ADD COLUMN     "result" TEXT NOT NULL;

-- DropEnum
DROP TYPE "GameResult";

-- DropEnum
DROP TYPE "GameType";

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_username_fkey" FOREIGN KEY ("username") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
