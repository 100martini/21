import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import GameRoomsManager from './game/GameRoomsManager.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();



const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/users', async (req, res) => {
    try {
        const userData = await prisma.user.findMany({});
        res.json(userData);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/gameHistory', async (req, res) => {
    try {
        const gameHistory = await prisma.gameHistory.findMany({});
        res.json(gameHistory);
    } catch (error) {
        console.error('Get game history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const roomsManager = new GameRoomsManager();

// Track player sessions for reconnection
const playerSessions = new Map(); // socketId -> { roomId, playerName, symbol }

// Cleanup old rooms periodically
setInterval(() => {
    roomsManager.rooms.forEach((room, roomId) => {
        if (room.shouldDelete()) {
            roomsManager.deleteRoom(roomId);
            io.emit('roomsList', roomsManager.getRoomsList());
        }
    });
}, 30000);

io.on('connection', (socket) => {
    socket.on('attemptReconnect', ({ roomId, playerName, symbol }) => {
        const room = roomsManager.getRoom(roomId);

        if (!room) {
            socket.emit('reconnectFailed', { message: 'Room no longer exists' });
            return;
        }

        const result = room.reconnectByIdentity(playerName, symbol, socket.id);

        if (result.success) {
            socket.join(roomId);
            playerSessions.set(socket.id, { roomId, playerName, symbol });
            socket.emit('reconnected', result.gameState);
            socket.to(roomId).emit('playerReconnected', { playerName, symbol });

            if (room.status === 'playing') {
                io.to(roomId).emit('gameResumed', room.getState());
            }
        } else {
            socket.emit('reconnectFailed', { message: result.message });
        }
    });

    socket.on('getRooms', () => {
        socket.emit('roomsList', roomsManager.getRoomsList());
    });

    socket.on('createRoom', ({ playerName }) => {
        const room = roomsManager.createRoom(socket.id, playerName);
        socket.join(room.id);

        // Track session
        playerSessions.set(socket.id, {
            roomId: room.id,
            playerName,
            symbol: 'X'
        });

        socket.emit('roomCreated', room.getState());
        io.emit('roomsList', roomsManager.getRoomsList());
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = roomsManager.getRoom(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const result = room.addPlayer(socket.id, playerName);

        if (!result.success) {
            socket.emit('error', { message: result.message });
            return;
        }

        socket.join(roomId);

        playerSessions.set(socket.id, { roomId, playerName, symbol: 'O' });

        io.to(roomId).emit('roomUpdated', room.getState());
        io.emit('roomsList', roomsManager.getRoomsList());

        if (room.players.length === 2) {
            io.to(roomId).emit('gameStart', room.getState());
        }
    });

    socket.on('makeMove', async ({ roomId, position }) => {
        const room = roomsManager.getRoom(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const result = room.makeMove(socket.id, position);

        if (!result.success) {
            socket.emit('error', { message: result.message });
            return;
        }

        io.to(roomId).emit('moveMade', {
            state: room.getState(),
            position,
            playerId: socket.id
        });

        if (room.winner || room.isDraw) {
            const [p1, p2] = room.players;
            if (p1 && p2) {
                if (room.isDraw) {
                    // Await all upserts before writing history so stats never diverge
                    await Promise.all([p1, p2].map(p =>
                        prisma.user.upsert({
                            where: { username: p.name },
                            create: { username: p.name, tictactoePlayed: 1, tictactoeDraws: 1 },
                            update: { tictactoePlayed: { increment: 1 }, tictactoeDraws: { increment: 1 } }
                        })
                    )).catch(err => console.error('DB error (draw upserts):', err));
                } else {
                    const winner = room.players.find(p => p.symbol === room.winner);
                    const loser = room.players.find(p => p.symbol !== room.winner);
                    await Promise.all([
                        prisma.user.upsert({
                            where: { username: winner.name },
                            create: { username: winner.name, tictactoePlayed: 1, tictactoeWins: 1 },
                            update: { tictactoePlayed: { increment: 1 }, tictactoeWins: { increment: 1 } }
                        }),
                        prisma.user.upsert({
                            where: { username: loser.name },
                            create: { username: loser.name, tictactoePlayed: 1, tictactoeLosses: 1 },
                            update: { tictactoePlayed: { increment: 1 }, tictactoeLosses: { increment: 1 } }
                        }),
                    ]).catch(err => console.error('DB error (win/loss upserts):', err));
                }

                await prisma.gameHistory.create({
                    data: {
                        gameType: "TICTACTOE",
                        roomId: roomId,
                        player1: p1.name,
                        player2: p2.name,
                        winner: room.isDraw ? "DRAW" : room.winner ? room.players.find(p => p.symbol === room.winner).name : "DRAW"
                    }
                }).catch(err => console.error('DB error (history makeMove):', err));
            }
        }
    });

    socket.on('resetGame', ({ roomId }) => {
        const room = roomsManager.getRoom(roomId);
        if (!room) return;

        if (!room.getPlayer(socket.id)) {
            socket.emit('error', { message: 'You are not in this room' });
            return;
        }

        room.reset();
        io.to(roomId).emit('gameReset', room.getState());
    });

    socket.on('leaveRoom', async ({ roomId }) => {
        const room = roomsManager.getRoom(roomId);
        if (!room) return;

        const leavingPlayer = room.getPlayer(socket.id);
        if (!leavingPlayer) return;

        const remainingPlayer = room.players.find(p => p.socketId !== socket.id);

        const alreadyDecided = !!(room.winner || room.isDraw);

        if (remainingPlayer && !alreadyDecided) {
            room.winner = remainingPlayer.symbol;
            room.status = 'finished';
        }

        if (remainingPlayer && !alreadyDecided) {
            socket.to(roomId).emit('opponentLeft', {
                playerName: leavingPlayer.name,
                winner: room.winner
            });
        }

        room.removePlayer(socket.id);
        playerSessions.delete(socket.id);

        roomsManager.deleteRoom(roomId);

        io.emit('roomsList', roomsManager.getRoomsList());

        if (remainingPlayer && !alreadyDecided) {
            await Promise.all([
                prisma.user.upsert({
                    where: { username: remainingPlayer.name },
                    create: { username: remainingPlayer.name, tictactoePlayed: 1, tictactoeWins: 1 },
                    update: { tictactoePlayed: { increment: 1 }, tictactoeWins: { increment: 1 } }
                }),
                prisma.user.upsert({
                    where: { username: leavingPlayer.name },
                    create: { username: leavingPlayer.name, tictactoePlayed: 1, tictactoeLosses: 1 },
                    update: { tictactoePlayed: { increment: 1 }, tictactoeLosses: { increment: 1 } }
                }),
            ]).catch(err => console.error('DB error (leaveRoom upserts):', err));

            // one record per game
            await prisma.gameHistory.create({
                data: {
                    gameType: "TICTACTOE",
                    roomId: roomId,
                    player1: remainingPlayer.name,
                    player2: leavingPlayer.name,
                    winner: remainingPlayer.name
                }
            }).catch(err => console.error('DB error (history):', err));
        }
    });

    // ── Spectating ────────────────────────────────────────────────────────────
    socket.on('watchRoom', ({ roomId, playerName }) => {
        const room = roomsManager.getRoom(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        if (room.status !== 'playing' && room.status !== 'paused') {
            socket.emit('error', { message: 'Game has not started yet' });
            return;
        }
        if (room.players.some(p => p.socketId === socket.id)) {
            socket.emit('error', { message: 'You are a player in this room' });
            return;
        }

        room.addSpectator(socket.id, playerName || 'Spectator');
        socket.join(roomId);

        socket.emit('watchConfirmed', room.getState());
        io.to(roomId).emit('spectatorUpdate', { spectatorCount: room.spectators.length });
        io.emit('roomsList', roomsManager.getRoomsList());
    });

    socket.on('leaveWatch', ({ roomId }) => {
        const room = roomsManager.getRoom(roomId);
        if (room) {
            room.removeSpectator(socket.id);
            socket.leave(roomId);
            io.to(roomId).emit('spectatorUpdate', { spectatorCount: room.spectators.length });
            io.emit('roomsList', roomsManager.getRoomsList());
        }
        playerSessions.delete(socket.id); // Prevent memory leak
    });

    socket.on('disconnect', () => {

        // Remove from spectator list if they were watching a room
        roomsManager.rooms.forEach((room, roomId) => {
            if (room.spectators.some(s => s.socketId === socket.id)) {
                room.removeSpectator(socket.id);
                io.to(roomId).emit('spectatorUpdate', { spectatorCount: room.spectators.length });
                io.emit('roomsList', roomsManager.getRoomsList());
            }
        });

        const session = playerSessions.get(socket.id);

        // If they were just spectating and not a player, delete the session and return
        if (session && !roomsManager.getRoom(session.roomId)?.getPlayer(socket.id)) {
            playerSessions.delete(socket.id);
            return;
        }

        if (session) {
            const { roomId, playerName, symbol } = session;
            const room = roomsManager.getRoom(roomId);

            if (room) {
                const disconnectInfo = room.handleDisconnect(socket.id);

                // Notify other players
                socket.to(roomId).emit('playerDisconnected', {
                    playerName: disconnectInfo?.playerName || playerName,
                    symbol: disconnectInfo?.symbol || symbol,
                    canReconnect: true,
                    reconnectTimeout: room.reconnectionTimeout
                });

                const currentDisconnectTime = disconnectInfo?.disconnectTime;

                setTimeout(async () => {
                    const currentRoom = roomsManager.getRoom(roomId);
                    if (currentRoom) {
                        const player = currentRoom.getPlayerBySymbol(symbol);
                        if (player && !player.connected && player.disconnectTime === currentDisconnectTime) {
                            const remainingPlayer = currentRoom.players.find(p => p.socketId !== player.socketId);

                            if (remainingPlayer && !currentRoom.winner && !currentRoom.isDraw) {
                                currentRoom.winner = remainingPlayer.symbol;
                                currentRoom.status = 'finished';

                                // Show win screen to remaining player
                                io.to(roomId).emit('opponentLeft', {
                                    playerName: disconnectInfo?.playerName || playerName,
                                    winner: currentRoom.winner
                                });
                            }

                            currentRoom.removePlayer(player.socketId);

                            if (currentRoom.players.length === 0) {
                                roomsManager.deleteRoom(roomId);
                            }

                            io.emit('roomsList', roomsManager.getRoomsList());
                            const currentSession = playerSessions.get(socket.id);
                            if (currentSession?.roomId === roomId) playerSessions.delete(socket.id);

                            if (remainingPlayer && !currentRoom.isDraw && currentRoom.winner === remainingPlayer.symbol) {
                                await Promise.all([
                                    prisma.user.upsert({
                                        where: { username: remainingPlayer.name },
                                        create: { username: remainingPlayer.name, tictactoePlayed: 1, tictactoeWins: 1 },
                                        update: { tictactoePlayed: { increment: 1 }, tictactoeWins: { increment: 1 } }
                                    }),
                                    prisma.user.upsert({
                                        where: { username: playerName },
                                        create: { username: playerName, tictactoePlayed: 1, tictactoeLosses: 1 },
                                        update: { tictactoePlayed: { increment: 1 }, tictactoeLosses: { increment: 1 } }
                                    }),
                                ]).catch(err => console.error('DB error (timeout upserts):', err));

                                await prisma.gameHistory.create({
                                    data: {
                                        gameType: "TICTACTOE",
                                        roomId: roomId,
                                        player1: remainingPlayer.name,
                                        player2: playerName,
                                        winner: remainingPlayer.name
                                    }
                                }).catch(err => console.error('DB error (history timeout):', err));
                            }
                        }
                    }
                }, room.reconnectionTimeout);
            }
        }
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Tic-Tac-Toe Server running on http://localhost:${PORT}`);
    console.log(`Reconnection enabled (15s timeout)`);
});