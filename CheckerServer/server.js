import express from "express";
import http from "http";
import { Server } from "socket.io";
import GameRoomsManager from "./game/GameRoomsManager.js";
import cors from "cors";
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

const roomsManager = new GameRoomsManager();

// ── REST endpoints ────────────────────────────────────────────────────────────
app.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({});
        res.json(users);
    } catch (err) {
        console.error('GET /users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/gameHistory', async (req, res) => {
    try {
        const gameHistory = await prisma.gameHistory.findMany({});
        res.json(gameHistory);
    } catch (err) {
        console.error('GET /gameHistory error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Track player sessions for reconnection: socketId -> { roomId, playerName, color }
const playerSessions = new Map();

// Matchmaking queue: [{ socketId, playerName }]
const matchmakingQueue = [];

// Cleanup inactive rooms every 30s
setInterval(() => {
    roomsManager.rooms.forEach((room, roomId) => {
        if (room.shouldDelete()) {
            roomsManager.deleteRoom(roomId);
            io.emit('roomsList', roomsManager.getRoomsList());
        }
    });
}, 30000);

io.on('connection', (socket) => {

    // ── Reconnection ──────────────────────────────────────────────────────────
    socket.on('attemptReconnect', ({ roomId, playerName, color }) => {
        const room = roomsManager.getRoom(roomId);

        if (!room) {
            socket.emit('reconnectFailed', { message: 'Room no longer exists' });
            return;
        }

        const result = room.reconnectByIdentity(playerName, color, socket.id);

        if (result.success) {
            socket.join(roomId);
            playerSessions.set(socket.id, { roomId, playerName, color });
            socket.emit('reconnected', result.gameState);
            socket.to(roomId).emit('playerReconnected', { playerName, color });

            if (room.status === 'playing') {
                io.to(roomId).emit('gameResumed', room.getState());
            }
        } else {
            socket.emit('reconnectFailed', { message: result.message });
        }
    });

    // ── Lobby ─────────────────────────────────────────────────────────────────
    socket.on('getRooms', () => {
        socket.emit('roomsList', roomsManager.getRoomsList());
    });

    socket.on('createRoom', ({ playerName }) => {
        const qIdx = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (qIdx !== -1) matchmakingQueue.splice(qIdx, 1);

        const room = roomsManager.createRoom(socket.id, playerName);
        socket.join(room.id);
        playerSessions.set(socket.id, { roomId: room.id, playerName, color: 'white' });
        socket.emit('roomCreated', room.getState());
        io.emit('roomsList', roomsManager.getRoomsList());
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const qIdx = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (qIdx !== -1) matchmakingQueue.splice(qIdx, 1);

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
        playerSessions.set(socket.id, { roomId, playerName, color: 'black' });

        io.to(roomId).emit('roomUpdated', room.getState());
        io.emit('roomsList', roomsManager.getRoomsList());

        if (room.players.length === 2) {
            io.to(roomId).emit('gameStart', room.getState());
        }
    });

    // ── Game ──────────────────────────────────────────────────────────────────
    socket.on('makeMove', async ({ roomId, move }) => {
        const room = roomsManager.getRoom(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const result = room.makeMove(socket.id, move);

        if (!result.success) {
            socket.emit('error', { message: result.message });
            return;
        }

        io.to(roomId).emit('moveMade', {
            state: room.getState(),
            move,
            playerId: socket.id
        });

        if (room.winner || room.isDraw) {
            const [p1, p2] = room.players;
            if (p1 && p2) {
                if (room.isDraw) {
                    await Promise.all([
                        prisma.user.upsert({
                            where: { username: p1.name },
                            create: { username: p1.name, checkersPlayed: 1, checkersDraws: 1 },
                            update: { checkersPlayed: { increment: 1 }, checkersDraws: { increment: 1 } }
                        }),
                        prisma.user.upsert({
                            where: { username: p2.name },
                            create: { username: p2.name, checkersPlayed: 1, checkersDraws: 1 },
                            update: { checkersPlayed: { increment: 1 }, checkersDraws: { increment: 1 } }
                        }),
                    ]).catch(err => console.error('DB error (checker draw upserts):', err));

                    await prisma.gameHistory.create({
                        data: {
                            gameType: "CHECKERS",
                            roomId: roomId,
                            player1: p1.name,
                            player2: p2.name,
                            winner: "DRAW"
                        }
                    }).catch(err => console.error('DB error (checker history draw makeMove):', err));
                } else {
                    const winner = room.players.find(p => p.color === room.winner);
                    const loser = room.players.find(p => p.color !== room.winner);
                    await Promise.all([
                        prisma.user.upsert({
                            where: { username: winner.name },
                            create: { username: winner.name, checkersPlayed: 1, checkersWins: 1 },
                            update: { checkersPlayed: { increment: 1 }, checkersWins: { increment: 1 } }
                        }),
                        prisma.user.upsert({
                            where: { username: loser.name },
                            create: { username: loser.name, checkersPlayed: 1, checkersLosses: 1 },
                            update: { checkersPlayed: { increment: 1 }, checkersLosses: { increment: 1 } }
                        }),
                    ]).catch(err => console.error('DB error (checker win/loss upserts):', err));

                    await prisma.gameHistory.create({
                        data: {
                            gameType: "CHECKERS",
                            roomId: roomId,
                            player1: p1.name,
                            player2: p2.name,
                            winner: winner.name
                        }
                    }).catch(err => console.error('DB error (checker history makeMove):', err));
                }
            }
        }
    });

    // Reset game — only a player in the room can trigger this
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

        const alreadyDecided = !!room.winner || room.isDraw;

        if (remainingPlayer && !alreadyDecided) {
            room.winner = remainingPlayer.color;
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

        // Update DB — only if not already recorded by makeMove
        if (remainingPlayer && !alreadyDecided) {
            await Promise.all([
                prisma.user.upsert({
                    where: { username: remainingPlayer.name },
                    create: { username: remainingPlayer.name, checkersPlayed: 1, checkersWins: 1 },
                    update: { checkersPlayed: { increment: 1 }, checkersWins: { increment: 1 } }
                }),
                prisma.user.upsert({
                    where: { username: leavingPlayer.name },
                    create: { username: leavingPlayer.name, checkersPlayed: 1, checkersLosses: 1 },
                    update: { checkersPlayed: { increment: 1 }, checkersLosses: { increment: 1 } }
                }),
            ]).catch(err => console.error('DB error (checker leaveRoom upserts):', err));

            await prisma.gameHistory.create({
                data: {
                    gameType: "CHECKERS",
                    roomId: roomId,
                    player1: remainingPlayer.name,
                    player2: leavingPlayer.name,
                    winner: remainingPlayer.name
                }
            }).catch(err => console.error('DB error (checker history leaveRoom):', err));
        }
    });

    // ── Matchmaking ───────────────────────────────────────────────────────────
    socket.on('joinQueue', ({ playerName }) => {
        if (!playerName?.trim()) return;

        // Don't add twice (by socket ID or by name)
        if (matchmakingQueue.find(p => p.socketId === socket.id)) return;
        if (matchmakingQueue.find(p => p.playerName === playerName)) return;

        if (matchmakingQueue.length > 0) {
            // Pair with the first waiting player
            const opponent = matchmakingQueue.shift();

            // Prevent ghost room: check name clash before creating the room
            if (opponent.playerName === playerName) {
                matchmakingQueue.unshift(opponent);
                socket.emit('error', { message: 'A player with that name is already waiting. Please use a different name.' });
                return;
            }

            const room = roomsManager.createRoom(opponent.socketId, opponent.playerName);
            const joinResult = room.addPlayer(socket.id, playerName);

            if (!joinResult.success) {
                matchmakingQueue.unshift(opponent);
                socket.emit('error', { message: 'Matchmaking failed, please try again' });
                return;
            }

            const opponentSock = io.sockets.sockets.get(opponent.socketId);

            if (!opponentSock) {
                roomsManager.deleteRoom(room.id);
                // Keep the current player in queue since the opponent was a ghost
                socket.emit('waitingForMatch');
                matchmakingQueue.push({ socketId: socket.id, playerName });
                return;
            }

            opponentSock.join(room.id);
            socket.join(room.id);

            // Track sessions
            playerSessions.set(opponent.socketId, { roomId: room.id, playerName: opponent.playerName, color: 'white' });
            playerSessions.set(socket.id, { roomId: room.id, playerName, color: 'black' });

            // Notify both players — game starts immediately
            io.to(room.id).emit('matchFound', room.getState());
            io.to(room.id).emit('gameStart', room.getState());
            io.emit('roomsList', roomsManager.getRoomsList());
        } else {
            // Nobody waiting — add to queue
            matchmakingQueue.push({ socketId: socket.id, playerName });
            socket.emit('waitingForMatch');
        }
    });

    socket.on('leaveQueue', () => {
        const idx = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
            matchmakingQueue.splice(idx, 1);
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
        // Notify players that a spectator joined
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

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {

        // Remove from matchmaking queue if they were waiting
        const queueIdx = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (queueIdx !== -1) matchmakingQueue.splice(queueIdx, 1);

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
            const { roomId, playerName, color } = session;
            const room = roomsManager.getRoom(roomId);

            if (room) {
                const disconnectInfo = room.handleDisconnect(socket.id);

                io.to(roomId).emit('playerDisconnected', {
                    playerName: disconnectInfo?.playerName || playerName,
                    color: disconnectInfo?.color || color,
                    canReconnect: true,
                    reconnectTimeout: room.reconnectionTimeout
                });

                const currentDisconnectTime = disconnectInfo?.disconnectTime;

                // Remove player after timeout if they haven't reconnected
                setTimeout(async () => {
                    const currentRoom = roomsManager.getRoom(roomId);
                    if (currentRoom) {
                        const player = currentRoom.getPlayerByColor(color);
                        if (player && !player.connected && player.disconnectTime === currentDisconnectTime) {
                            const remainingPlayer = currentRoom.players.find(p => p.socketId !== player.socketId);

                            const timeoutAlreadyDecided = !!currentRoom.winner || currentRoom.isDraw;
                            if (remainingPlayer && !timeoutAlreadyDecided) {
                                currentRoom.winner = remainingPlayer.color;
                                currentRoom.status = 'finished';

                                // Notify remaining player they won (shows win screen)
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

                            // Update DB for timeout disconnect
                            if (remainingPlayer && !timeoutAlreadyDecided) {
                                await Promise.all([
                                    prisma.user.upsert({
                                        where: { username: remainingPlayer.name },
                                        create: { username: remainingPlayer.name, checkersPlayed: 1, checkersWins: 1 },
                                        update: { checkersPlayed: { increment: 1 }, checkersWins: { increment: 1 } }
                                    }),
                                    prisma.user.upsert({
                                        where: { username: playerName },
                                        create: { username: playerName, checkersPlayed: 1, checkersLosses: 1 },
                                        update: { checkersPlayed: { increment: 1 }, checkersLosses: { increment: 1 } }
                                    }),
                                ]).catch(err => console.error('DB error (checker timeout upserts):', err));

                                await prisma.gameHistory.create({
                                    data: {
                                        gameType: "CHECKERS",
                                        roomId: roomId,
                                        player1: remainingPlayer.name,
                                        player2: playerName,
                                        winner: remainingPlayer.name
                                    }
                                }).catch(err => console.error('DB error (checker history timeout):', err));
                            }
                        }
                    }
                }, room.reconnectionTimeout);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Checkers Server running on http://localhost:${PORT}`);
    console.log(`Reconnection enabled (15s timeout)`);
});