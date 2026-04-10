import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const NUM_USERS = 50;
    const users = [];

    // Create 50 Users for Tic-Tac-Toe
    for (let i = 1; i <= NUM_USERS; i++) {
        const username = `user${i}`;
        const user = await prisma.user.upsert({
            where: { username },
            update: {
                tictactoePlayed: 25,
                tictactoeWins: 10,
                tictactoeLosses: 10,
                tictactoeDraws: 5,
            },
            create: {
                username,
                tictactoePlayed: 25,
                tictactoeWins: 10,
                tictactoeLosses: 10,
                tictactoeDraws: 5,
            },
        });
        users.push(user);
    }

    const gameHistoryData = [];

    // For each user, we need to create 25 games (10 wins, 10 losses, 5 draws)
    for (let i = 0; i < NUM_USERS; i++) {
        const player1 = users[i].username;
        // The opponent will be the next user in the list (wrapping around)
        const player2 = users[(i + 1) % NUM_USERS].username;

        // 10 Wins
        for (let j = 0; j < 10; j++) {
            gameHistoryData.push({
                roomId: `ttt-seed-${player1}-win-${j}`,
                gameType: 'TICTACTOE',
                player1,
                player2,
                winner: player1,
                playedAt: new Date(Date.now() - 1000 * 60 * 60 * (Math.random() * 24 * 30)), // Random time in last 30 days
            });
        }

        // 10 Losses
        for (let j = 0; j < 10; j++) {
            gameHistoryData.push({
                roomId: `ttt-seed-${player1}-loss-${j}`,
                gameType: 'TICTACTOE',
                player1,
                player2,
                winner: player2,
                playedAt: new Date(Date.now() - 1000 * 60 * 60 * (Math.random() * 24 * 30)),
            });
        }

        // 5 Draws
        for (let j = 0; j < 5; j++) {
            gameHistoryData.push({
                roomId: `ttt-seed-${player1}-draw-${j}`,
                gameType: 'TICTACTOE',
                player1,
                player2,
                winner: 'DRAW',
                playedAt: new Date(Date.now() - 1000 * 60 * 60 * (Math.random() * 24 * 30)),
            });
        }
    }

    // Insert Game History
    await prisma.gameHistory.createMany({
        data: gameHistoryData,
        skipDuplicates: true
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
