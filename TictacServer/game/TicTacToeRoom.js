class TicTacToeRoom {
    constructor(id, creatorSocketId, creatorName = 'Player 1') {
        this.id = id;
        this.players = [
            {
                socketId: creatorSocketId,
                symbol: 'X',
                name: creatorName,
                connected: true,
                lastSeen: Date.now()
            }
        ];
        this.board = Array(9).fill(null);
        this.currentTurn = 'X';
        this.lastStartingSymbol = 'X';
        this.winner = null;
        this.isDraw = false;
        this.status = 'waiting'; // waiting, playing, finished, paused
        this.winningLine = null;
        this.createdAt = Date.now();
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
            symbol: 'O',
            name: playerName,
            connected: true,
            lastSeen: Date.now()
        });
        this.status = 'playing';
        this.lastActivity = Date.now();
        return { success: true };
    }

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
            symbol: player.symbol,
            disconnectTime: player.disconnectTime
        };
    }


    // Reconnect by player name + symbol — used after a page refresh when the socket ID has changed.
    reconnectByIdentity(playerName, symbol, newSocketId) {
        const player = this.players.find(p =>
            p.name === playerName && p.symbol === symbol
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

    getPlayerBySymbol(symbol) {
        return this.players.find(p => p.symbol === symbol);
    }

    isFull() {
        return this.players.length >= 2;
    }

    isPlayerTurn(socketId) {
        const player = this.getPlayer(socketId);
        return player && player.symbol === this.currentTurn && player.connected;
    }

    shouldDelete() {
        const now = Date.now();
        const allPlayersGone = this.players.every(p => !p.connected);
        const roomTooOld = (now - this.lastActivity) > this.reconnectionTimeout;
        const finishedRoomTooOld = (now - this.lastActivity) > 120000; // 2 minutes for finished games
        const isFinished = this.status === 'finished';
        return (this.players.length === 0) || (allPlayersGone && roomTooOld) || (isFinished && finishedRoomTooOld);
    }

    isActive() {
        return this.players.some(p => p.connected);
    }

    makeMove(socketId, position) {
        if (this.status === 'paused') {
            return { success: false, message: 'Game is paused' };
        }

        if (!this.isPlayerTurn(socketId)) {
            return { success: false, message: 'Not your turn' };
        }

        if (typeof position !== 'number' || position < 0 || position > 8 || !Number.isInteger(position)) {
            return { success: false, message: 'Invalid position' };
        }

        if (this.board[position] !== null) {
            return { success: false, message: 'Square already taken' };
        }

        if (this.winner || this.isDraw) {
            return { success: false, message: 'Game is over' };
        }

        const player = this.getPlayer(socketId);
        this.board[position] = player.symbol;

        const result = this.calculateWinner();
        if (result) {
            this.winner = result.winner;
            this.winningLine = result.line;
            this.status = 'finished';
        } else if (this.board.every(sq => sq !== null)) {
            this.isDraw = true;
            this.status = 'finished';
        } else {
            this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
        }

        this.lastActivity = Date.now();
        return { success: true };
    }

    calculateWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6]             // diagonals
        ];

        for (const [a, b, c] of lines) {
            if (this.board[a] &&
                this.board[a] === this.board[b] &&
                this.board[a] === this.board[c]) {
                return {
                    winner: this.board[a],
                    line: [a, b, c]
                };
            }
        }
        return null;
    }

    getState() {
        return {
            id: this.id,
            players: this.players.map(p => ({
                socketId: p.socketId,
                symbol: p.symbol,
                name: p.name,
                connected: p.connected
            })),
            board: this.board,
            currentTurn: this.currentTurn,
            winner: this.winner,
            winningLine: this.winningLine,
            isDraw: this.isDraw,
            status: this.status,
            isPaused: this.status === 'paused',
            spectatorCount: this.spectators.length
        };
    }

    reset() {
        this.board = Array(9).fill(null);
        this.lastStartingSymbol = this.lastStartingSymbol === 'X' ? 'O' : 'X';
        this.currentTurn = this.lastStartingSymbol;
        this.winner = null;
        this.isDraw = false;
        this.winningLine = null;
        this.status = this.players.length === 2 ? 'playing' : 'waiting';
        this.lastActivity = Date.now();
    }
}

export default TicTacToeRoom;