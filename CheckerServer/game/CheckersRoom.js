class CheckersRoom {
    constructor(id, creatorSocketId, creatorName = 'Player 1') {
        this.id = id;
        this.players = [
            {
                socketId: creatorSocketId,
                color: 'white',
                name: creatorName,
                connected: true,
                lastSeen: Date.now()
            }
        ];
        this.board = this.initBoard();
        this.currentTurn = 'white';
        this.winner = null;
        this.status = 'waiting'; // waiting, playing, finished, paused
        this.createdAt = Date.now();
        this.isDraw = false;
        this.lastActivity = Date.now();

        this.spectators = [];
        this.reconnectionTimeout = 15000;
    }

    addSpectator(socketId, name) {
        if (this.spectators.some(s => s.socketId === socketId)) return;
        this.spectators.push({ socketId, name });
    }

    removeSpectator(socketId) {
        const idx = this.spectators.findIndex(s => s.socketId === socketId);
        if (idx !== -1) this.spectators.splice(idx, 1);
    }

    initBoard() {
        const board = Array(64).fill(null);

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    if (row < 3) {
                        board[row * 8 + col] = { color: 'black', isKing: false };
                    } else if (row > 4) {
                        board[row * 8 + col] = { color: 'white', isKing: false };
                    }
                }
            }
        }

        return board;
    }

    addPlayer(socketId, playerName) {
        if (this.players.length >= 2) {
            return { success: false, message: 'Room is full' };
        }
        if (this.players.some(p => p.socketId === socketId)) {
            return { success: false, message: 'You are already in this room' };
        }
        if (this.players.some(p => p.name === playerName)) {
            return { success: false, message: 'A player with that name is already in this room' };
        }
        this.players.push({
            socketId,
            color: 'black',
            name: playerName,
            connected: true,
            lastSeen: Date.now()
        });
        this.status = 'playing';
        this.lastActivity = Date.now();
        return { success: true };
    }

    // Handle player disconnection
    handleDisconnect(socketId) {
        const player = this.getPlayer(socketId);
        if (!player) return;

        player.connected = false;
        player.lastSeen = Date.now();

        if (this.status === 'playing') {
            this.status = 'paused';
        }

        player.disconnectTime = Date.now();

        return {
            playerId: socketId,
            playerName: player.name,
            color: player.color,
            disconnectTime: player.disconnectTime
        };
    }

    // Reconnect by player name + colour — used after a page refresh when the socket ID has changed.
    reconnectByIdentity(playerName, color, newSocketId) {
        const player = this.players.find(p =>
            p.name === playerName && p.color === color
        );

        if (!player) {
            return { success: false, message: 'Player not found' };
        }

        player.socketId = newSocketId;
        player.connected = true;
        player.lastSeen = Date.now();
        this.lastActivity = Date.now();

        if (this.status === 'paused' && this.players.every(p => p.connected)) {
            this.status = 'playing';
        }

        return {
            success: true,
            player,
            gameState: this.getState()
        };
    }

    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            this.players.splice(index, 1);
            this.status = 'finished';
        }
    }

    getPlayer(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }

    getPlayerByColor(color) {
        return this.players.find(p => p.color === color);
    }

    isPlayerTurn(socketId) {
        const player = this.getPlayer(socketId);
        return player && player.color === this.currentTurn && player.connected;
    }

    // Returns true when the room should be garbage-collected by the cleanup interval.
    shouldDelete() {
        const now = Date.now();
        const allPlayersGone = this.players.every(p => !p.connected);
        const roomTooOld = (now - this.lastActivity) > this.reconnectionTimeout;
        const finishedRoomTooOld = (now - this.lastActivity) > 120000; // 2 minutes for finished games
        const isFinished = this.status === 'finished';
        return (this.players.length === 0) || (allPlayersGone && roomTooOld) || (isFinished && finishedRoomTooOld);
    }

    makeMove(socketId, move) {
        if (this.status === 'paused') {
            return { success: false, message: 'Game is paused' };
        }

        if (!this.isPlayerTurn(socketId)) {
            return { success: false, message: 'Not your turn' };
        }

        const { from, to } = move;
        const piece = this.board[from];

        if (!piece || piece.color !== this.currentTurn) {
            return { success: false, message: 'Invalid piece' };
        }

        const validMoves = this.getValidMovesForPiece(from);
        const matched = validMoves.find(m => m.to === to);

        if (!matched) {
            return { success: false, message: 'Invalid move' };
        }

        this.board[to] = { ...piece };
        this.board[from] = null;

        if (matched.captured !== undefined) {
            this.board[matched.captured] = null;
        }

        // Promote to king when reaching the opposite back rank.
        const toRow = Math.floor(to / 8);
        if ((piece.color === 'white' && toRow === 0) ||
            (piece.color === 'black' && toRow === 7)) {
            this.board[to].isKing = true;
        }

        const nextTurn = this.currentTurn === 'white' ? 'black' : 'white';
        const result = this.calculateWinner(nextTurn);
        if (result === 'draw') {
            this.isDraw = true;
            this.status = 'finished';
        } else if (result) {
            this.winner = result;
            this.status = 'finished';
        } else {
            this.currentTurn = nextTurn;
        }

        this.lastActivity = Date.now();
        return { success: true };
    }

    getValidMovesForPiece(index) {
        const piece = this.board[index];
        if (!piece) return [];

        const row = Math.floor(index / 8);
        const col = index % 8;
        const moves = [];

        // White moves up (negative row), black moves down (positive row); kings move both directions.
        const directions = [];
        if (piece.color === 'white') {
            directions.push([-1, -1], [-1, 1]);
            if (piece.isKing) directions.push([1, -1], [1, 1]);
        } else {
            directions.push([1, -1], [1, 1]);
            if (piece.isKing) directions.push([-1, -1], [-1, 1]);
        }

        directions.forEach(direction => {
            const newRow = row + direction[0];
            const newCol = col + direction[1];

            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = newRow * 8 + newCol;

                if (!this.board[target]) {
                    moves.push({ to: target });
                } else {
                    const captureRow = row + direction[0] * 2;
                    const captureCol = col + direction[1] * 2;

                    if (captureRow >= 0 && captureRow < 8 && captureCol >= 0 && captureCol < 8) {
                        const captureTarget = captureRow * 8 + captureCol;
                        if (!this.board[captureTarget]) {
                            const enemyPiece = this.board[target];
                            if ((piece.color === 'white' && enemyPiece.color === 'black') ||
                                (piece.color === 'black' && enemyPiece.color === 'white')) {
                                moves.push({ to: captureTarget, captured: target });
                            }
                        }
                    }
                }
            }
        });

        return moves;
    }

    calculateWinner(nextTurn) {
        const whitePieces = this.board.filter(p => p?.color === 'white').length;
        const blackPieces = this.board.filter(p => p?.color === 'black').length;

        if (whitePieces === 0) return 'black';
        if (blackPieces === 0) return 'white';

        // A draw occurs when the next player has no legal moves remaining.
        if (nextTurn && !this.hasAnyMoves(nextTurn)) return 'draw';
        return null;
    }

    hasAnyMoves(color) {
        for (let i = 0; i < 64; i++) {
            if (this.board[i]?.color === color && this.getValidMovesForPiece(i).length > 0)
                return true;
        }
        return false;
    }

    getState() {
        return {
            id: this.id,
            players: this.players.map(p => ({
                socketId: p.socketId,
                color: p.color,
                name: p.name,
                connected: p.connected
            })),
            board: this.board,
            currentTurn: this.currentTurn,
            winner: this.winner,
            isDraw: this.isDraw,
            status: this.status,
            isPaused: this.status === 'paused',
            spectatorCount: this.spectators.length
        };
    }

    reset() {
        this.board = this.initBoard();
        this.currentTurn = 'white';
        this.winner = null;
        this.isDraw = false;
        this.status = this.players.length === 2 ? 'playing' : 'waiting';
        this.lastActivity = Date.now();
    }
}

export default CheckersRoom;
