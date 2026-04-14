import "../styles/Checkers_online.css";
import SharedLayout from "../SharedLayout";
import { useState, useEffect, useRef } from "react";
import { getSocket, saveSession, clearSession, getSavedSession, pauseSocket } from "./socket";

export default function CheckersMultiplayer() {
    // Read user once from sessionStorage — not on every render
    const [user] = useState(() => {
        try {
            const str = sessionStorage.getItem('user');
            return str ? JSON.parse(str) : {};
        } catch {
            return {};
        }
    });

    // Connection & Lobby State
    const [isConnected, setIsConnected] = useState(false);
    const [playerName, setPlayerName] = useState(user.login || "");
    const [roomId, setRoomId] = useState("");
    const [isInRoom, setIsInRoom] = useState(false);
    const [isInQueue, setIsInQueue] = useState(false);
    const [myColor, setMyColor] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);

    // Game State
    const [board, setBoard] = useState(Array(64).fill(null));
    const [currentTurn, setCurrentTurn] = useState('white');
    const [selectedPiece, setSelectedPiece] = useState(null);
    const [validMoves, setValidMoves] = useState([]);
    const [winner, setWinner] = useState(null);
    const [isDraw, setIsDraw] = useState(false);
    const [isMyTurn, setIsMyTurn] = useState(false);

    // Reconnection State
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);

    // Spectator State
    const [isSpectating, setIsSpectating] = useState(false);
    const [spectatorCount, setSpectatorCount] = useState(0);
    const [spectatingRoomId, setSpectatingRoomId] = useState("");
    const [spectatorPlayers, setSpectatorPlayers] = useState({ white: null, black: null });

    const notifTimerRef = useRef(null);
    const isSpectatingRef = useRef(false);
    useEffect(() => { isSpectatingRef.current = isSpectating; }, [isSpectating]);

    const showNotification = (message, duration = 3000) => {
        if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
        setNotification(message);
        notifTimerRef.current = setTimeout(() => setNotification(null), duration);
    };

    // Initialize socket connection
    useEffect(() => {
        const socket = getSocket();

        socket.on('connect', () => {
            setIsConnected(true);
            console.log(' Socket connected:', socket.id);
            handleConnectLogic(socket);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from server');
        });

        // Reconnection Events
        socket.on('reconnected', (gameState) => {
            console.log('Successfully reconnected!');
            setIsReconnecting(false);
            setIsInRoom(true);
            setRoomId(gameState.id);
            setBoard(gameState.board);
            setCurrentTurn(gameState.currentTurn);
            setWinner(gameState.winner);
            setIsDraw(gameState.isDraw || false);
            setSpectatorCount(gameState.spectatorCount || 0);
            // Clear any stale piece selection from before the disconnect
            setSelectedPiece(null);
            setValidMoves([]);

            const me = gameState.players.find(p => p.socketId === socket.id);
            const opp = gameState.players.find(p => p.socketId !== socket.id);

            if (me) {
                setMyColor(me.color);
                setIsMyTurn(me.color === gameState.currentTurn && !gameState.winner && !gameState.isDraw);
            }
            if (opp) {
                setOpponent(opp.name);
                setOpponentDisconnected(!opp.connected);
            }

            showNotification('Reconnected to game!');
        });

        socket.on('reconnectFailed', ({ message }) => {
            console.log('Reconnection failed:', message);
            setIsReconnecting(false);
            clearSession();
            showNotification(`Could not reconnect: ${message}`, 5000);
            resetGame();
        });

        socket.on('playerDisconnected', ({ playerName, canReconnect, reconnectTimeout }) => {
            setOpponentDisconnected(true);
            if (canReconnect) {
                const seconds = Math.floor(reconnectTimeout / 1000);
                showNotification(
                    `${playerName} disconnected. Waiting ${seconds}s for reconnection...`,
                    5000
                );
            } else {
                showNotification(`${playerName} left the game`, 5000);
            }
        });

        socket.on('playerReconnected', ({ playerName }) => {
            setOpponentDisconnected(false);
            showNotification(`${playerName} reconnected!`);
        });

        socket.on('gameResumed', (state) => {
            updateGameState(state);
            showNotification('Game resumed!');
        });

        // Room Events
        socket.on('roomsList', (rooms) => {
            setAvailableRooms(rooms);
            setIsLoadingRooms(false);
        });

        socket.on('roomCreated', (state) => {
            setIsInRoom(true);
            setRoomId(state.id);
            setMyColor('white');
            setBoard(state.board);
            setCurrentTurn(state.currentTurn);
            setIsMyTurn(state.currentTurn === 'white');
            setIsDraw(false);
            setSpectatorCount(0);
            saveSession(state.id, playerName, 'white');
        });

        socket.on('roomUpdated', (state) => {
            setIsInRoom(true);
            updateGameState(state);

            const opponentPlayer = state.players.find(p => p.socketId !== socket.id);
            if (opponentPlayer) setOpponent(opponentPlayer.name);

            const me = state.players.find(p => p.socketId === socket.id);
            if (me) saveSession(state.id, playerName, me.color);
        });

        socket.on('gameStart', (state) => {
            console.log('Game started!');
            updateGameState(state);

            const me = state.players.find(p => p.socketId === socket.id);
            if (me) {
                setMyColor(me.color);
                setIsMyTurn(me.color === state.currentTurn);
            }
        });

        socket.on('moveMade', ({ state }) => {
            updateGameState(state);
        });

        socket.on('gameReset', (state) => {
            updateGameState(state);
        });


        // Opponent intentionally left — we win!
        socket.on('opponentLeft', ({ playerName, winner: winnerColor }) => {
            if (!isSpectatingRef.current) {
                showNotification(`${playerName} left. You win!`, 5000);
            }
            if (winnerColor) setWinner(winnerColor);
        });

        socket.on('error', ({ message }) => {
            showNotification(`⚠️ ${message}`, 4000);
        });

        // Matchmaking events
        socket.on('waitingForMatch', () => {
            setIsInQueue(true);
            showNotification('🔍 Searching for an opponent...', 8000);
        });

        socket.on('matchFound', (state) => {
            setIsInQueue(false);
            setIsInRoom(true);
            setRoomId(state.id);
            setBoard(state.board);
            setCurrentTurn(state.currentTurn);
            setWinner(null);
            setIsDraw(false);
            setSpectatorCount(0);

            const me = state.players.find(p => p.socketId === socket.id);
            const opp = state.players.find(p => p.socketId !== socket.id);
            if (me) {
                setMyColor(me.color);
                setIsMyTurn(me.color === state.currentTurn);
                saveSession(state.id, playerName, me.color);
            }
            if (opp) setOpponent(opp.name);

            showNotification('✅ Opponent found! Game starting...', 3000);
        });

        // ── Spectator events ────────────────────────────────────────────────────
        socket.on('watchConfirmed', (state) => {
            setIsSpectating(true);
            setSpectatingRoomId(state.id);
            setBoard(state.board);
            setCurrentTurn(state.currentTurn);
            setWinner(state.winner);
            setIsDraw(state.isDraw || false);
            setSpectatorCount(state.spectatorCount || 0);

            const [p1, p2] = state.players;
            setMyColor(null); // spectators have no color
            setSpectatorPlayers({
                white: p1?.name || 'Player 1',
                black: p2?.name || 'Player 2',
            });
            setOpponent(p2?.name || null);
        });

        socket.on('spectatorUpdate', ({ spectatorCount: sc }) => {
            setSpectatorCount(sc);
        });

        // All listeners registered — now connect or trigger reconnect
        if (socket.connected) {
            setIsConnected(true);
            handleConnectLogic(socket);
        } else {
            socket.connect();
        }

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('roomsList');
            socket.off('roomCreated');
            socket.off('roomUpdated');
            socket.off('gameStart');
            socket.off('moveMade');
            socket.off('gameReset');
            socket.off('opponentLeft');
            socket.off('error');
            socket.off('reconnected');
            socket.off('reconnectFailed');
            socket.off('playerDisconnected');
            socket.off('playerReconnected');
            socket.off('gameResumed');
            socket.off('waitingForMatch');
            socket.off('matchFound');
            socket.off('watchConfirmed');
            socket.off('spectatorUpdate');
            pauseSocket();
        };
    }, []);

    // Decides whether to attempt game reconnect or load the lobby room list
    const handleConnectLogic = (socket) => {
        const saved = getSavedSession();
        if (saved && saved.roomId) {
            setIsReconnecting(true);
            showNotification('🔄 Reconnecting to game...', 10000);
            socket.emit('attemptReconnect', saved);
        } else {
            loadAvailableRooms();
        }
    };

    const updateGameState = (state) => {
        setBoard(state.board);
        setCurrentTurn(state.currentTurn);
        setWinner(state.winner);
        setIsDraw(state.isDraw || false);
        if (state.spectatorCount !== undefined) setSpectatorCount(state.spectatorCount);

        const socket = getSocket();
        const me = state.players.find(p => p.socketId === socket.id);
        if (me) {
            setIsMyTurn(me.color === state.currentTurn && !state.winner && !state.isDraw);
        }
    };

    const loadAvailableRooms = () => {
        const socket = getSocket();
        socket.emit('getRooms');
        setIsLoadingRooms(true);
    };

    const createRoom = () => {
        if (!playerName.trim()) { showNotification('Please enter your name', 3000); return; }
        const socket = getSocket();
        socket.emit('createRoom', { playerName });
    };

    const joinRoom = (targetRoomId) => {
        if (!playerName.trim()) { showNotification('Please enter your name', 3000); return; }
        const idToJoin = targetRoomId || roomId;
        if (!idToJoin.trim()) { showNotification('Please enter a room ID', 3000); return; }
        const socket = getSocket();
        socket.emit('joinRoom', { roomId: idToJoin, playerName });
        setRoomId(idToJoin);
    };

    const joinRandomRoom = () => {
        if (!playerName.trim()) { showNotification('Please enter your name', 3000); return; }
        const socket = getSocket();
        socket.emit('joinQueue', { playerName });
    };

    const cancelQueue = () => {
        const socket = getSocket();
        socket.emit('leaveQueue');
        setIsInQueue(false);
        showNotification('Matchmaking cancelled', 2000);
    };

    // ── Spectator actions ────────────────────────────────────────────────────
    const watchRoom = (targetRoomId) => {
        if (!playerName.trim()) { showNotification('Please enter your name first', 3000); return; }
        const socket = getSocket();
        socket.emit('watchRoom', { roomId: targetRoomId, playerName });
    };

    const stopWatching = () => {
        const socket = getSocket();
        socket.emit('leaveWatch', { roomId: spectatingRoomId });
        setIsSpectating(false);
        setSpectatingRoomId("");
        setSpectatorPlayers({ white: null, black: null });
        setBoard(Array(64).fill(null));
        setWinner(null);
        setIsDraw(false);
        setOpponent(null);
        setSpectatorCount(0);
        setCurrentTurn('white');
        loadAvailableRooms();
    };

    const handleSquareClick = (index) => {
        if (isSpectating) return;
        if (!isMyTurn || winner || isDraw || !opponent || opponentDisconnected) return;

        const piece = board[index];

        // Clicking a valid-move square → move
        if (selectedPiece !== null && validMoves.some(m => m.to === index)) {
            makeMove(index);
            return;
        }

        // Clicking own piece → select
        if (piece && piece.color === myColor) {
            const moves = getValidMoves(index);
            setSelectedPiece(index);
            setValidMoves(moves);
            return;
        }

        // Clicking elsewhere → deselect
        setSelectedPiece(null);
        setValidMoves([]);
    };

    const getValidMoves = (index) => {
        const piece = board[index];
        if (!piece) return [];

        const row = Math.floor(index / 8);
        const col = index % 8;
        const moves = [];

        // White moves up (negative row), black moves down; kings move both directions.
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

                if (!board[target]) {
                    moves.push({ to: target });
                } else {
                    const captureRow = row + direction[0] * 2;
                    const captureCol = col + direction[1] * 2;

                    if (captureRow >= 0 && captureRow < 8 && captureCol >= 0 && captureCol < 8) {
                        const captureTarget = captureRow * 8 + captureCol;
                        if (!board[captureTarget]) {
                            const enemyPiece = board[target];
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
    };

    const makeMove = (to) => {
        const socket = getSocket();
        socket.emit('makeMove', { roomId, move: { from: selectedPiece, to } });
        setSelectedPiece(null);
        setValidMoves([]);
    };

    const resetGame = () => {
        clearSession();
        setIsInRoom(false);
        setRoomId("");
        setBoard(Array(64).fill(null));
        setCurrentTurn('white');
        setSelectedPiece(null);
        setValidMoves([]);
        setWinner(null);
        setIsDraw(false);
        setMyColor(null);
        setOpponent(null);
        setIsMyTurn(false);
        setOpponentDisconnected(false);
        setSpectatorCount(0);
    };

    const leaveRoom = () => {
        const socket = getSocket();
        socket.emit('leaveRoom', { roomId }); // always notify server so room is cleaned up
        clearSession();
        resetGame();
    };

    const backToLobby = () => {
        const socket = getSocket();
        socket.emit('leaveRoom', { roomId }); // always notify server so room is cleaned up
        clearSession();
        resetGame();
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        showNotification('📋 Room ID copied!', 2000);
    };

    const renderPiece = (piece) => {
        if (!piece) return null;
        return <div className={`piece ${piece.color} ${piece.isKing ? 'king' : ''}`} />;
    };

    const indexToRowCol = (index) => ({
        row: Math.floor(index / 8),
        col: index % 8
    });

    const whitePlayer = isSpectating ? spectatorPlayers.white : (myColor === 'white' ? playerName : opponent);
    const blackPlayer = isSpectating ? spectatorPlayers.black : (myColor === 'black' ? playerName : opponent);

    return (
        <SharedLayout user={user.login ? user : null}>
            <div className="checkers-online-wrapper">
                <div className="container">

                    {/* Notification Toast */}
                    {notification && (
                        <div className="notification-toast">{notification}</div>
                    )}

                    {/* Reconnecting Overlay */}
                    {isReconnecting && (
                        <div className="reconnecting-overlay">
                            <div className="reconnecting-spinner" />
                            <p>Reconnecting to game...</p>
                        </div>
                    )}

                    {/* Header */}
                    <header className="header">
                        <a href="/checkers" className="back-btn" aria-label="Back">
                            <span className="back-arrow">←</span>
                        </a>
                        <div>
                            <h1 className="title">Checkers — Online</h1>
                            <p className="subtitle">Play online with friends</p>
                        </div>
                    </header>

                    {/* Connection Status */}
                    <div className="connection-status">
                        <span className={`status-dot ${isReconnecting ? 'reconnecting' :
                            isConnected ? 'connected' : 'disconnected'}`} />
                        <span className="status-text">
                            {isReconnecting
                                ? 'Reconnecting...'
                                : isConnected
                                    ? 'Connected to server'
                                    : 'Disconnected - Check server'}
                        </span>
                    </div>

                    {/* ===== SPECTATOR VIEW ===== */}
                    {isSpectating ? (
                        <div className="game-area">
                            {/* Spectator badge */}
                            <div className="spectator-badge">
                                <span className="spectator-eye">👁</span>
                                <span>Spectating</span>
                                <span className="spectator-count">{spectatorCount} watching</span>
                            </div>

                            {/* Room Info */}
                            <div className="card room-info-card">
                                <div className="room-header">
                                    <div>
                                        <p className="info-label">Room ID</p>
                                        <div className="room-id-row">
                                            <p className="room-id-big">{spectatingRoomId}</p>
                                        </div>
                                    </div>
                                    <div className="color-badge">
                                        <p className="info-label">Turn</p>
                                        <div className="color-display">
                                            <span className={`color-circle ${currentTurn}`} />
                                            <p className="color-text">{currentTurn === 'white' ? 'White' : 'Black'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="players-row">
                                    <div className="player-box">
                                        <p className="player-label">⬜ White</p>
                                        <p className="player-name">{whitePlayer || 'Player 1'}</p>
                                    </div>
                                    <div className="player-box">
                                        <p className="player-label">⬛ Black</p>
                                        <p className="player-name">{blackPlayer || 'Player 2'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Status Bar / Winner Banner */}
                            {winner ? (
                                <div className="card winner-banner">
                                    <p className="winner-text">
                                        {winner === 'white' ? (whitePlayer || 'White') : (blackPlayer || 'Black')} Wins!
                                    </p>
                                    <div className="winner-actions">
                                        <button onClick={stopWatching} className="btn btn-secondary">
                                            Back to Lobby
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="card status-bar">
                                    <span className="turn-indicator active" />
                                    <p className="turn-text">
                                        {currentTurn === 'white'
                                            ? `${whitePlayer || 'White'}'s Turn`
                                            : `${blackPlayer || 'Black'}'s Turn`}
                                    </p>
                                </div>
                            )}

                            {/* Board — read-only for spectators */}
                            <div className="card board-card">
                                <div className="board">
                                    {board.map((piece, index) => {
                                        const { row, col } = indexToRowCol(index);
                                        const isDark = (row + col) % 2 === 1;
                                        return (
                                            <button
                                                key={index}
                                                disabled
                                                className={`square ${isDark ? 'dark' : 'light'}`}
                                            >
                                                {renderPiece(piece)}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="board-hint">You are spectating — board is read-only</p>
                            </div>

                            <button onClick={stopWatching} className="btn btn-leave">
                                Stop Watching
                            </button>
                        </div>

                    ) : !isInRoom ? (
                        /* ===== LOBBY ===== */
                        <div className="card lobby-card">
                            <h2 className="card-title">Join or Create Room</h2>

                            {/* Matchmaking waiting state */}
                            {isInQueue && (
                                <div className="queue-banner">
                                    <div className="queue-spinner" />
                                    <div>
                                        <p className="queue-text">Searching for an opponent...</p>
                                        <p className="queue-sub">You'll be matched automatically</p>
                                    </div>
                                    <button onClick={cancelQueue} className="btn-cancel-queue">
                                        Cancel
                                    </button>
                                </div>
                            )}

                            <div className="form-fields">
                                <div className="field">
                                    <label className="field-label">Your Name</label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        placeholder="Enter your name"
                                        className="field-input"
                                        readOnly={!!user.login}
                                    />
                                </div>

                                <div className="field">
                                    <label className="field-label">Room ID (to join existing)</label>
                                    <input
                                        type="text"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                        placeholder="Enter room ID"
                                        className="field-input"
                                    />
                                </div>
                            </div>

                            <div className="button-row">
                                <button onClick={createRoom} disabled={!isConnected || isInQueue} className="btn btn-primary">
                                    Create New Room
                                </button>
                                <button onClick={() => joinRoom()} disabled={!isConnected || !roomId.trim() || isInQueue} className="btn btn-secondary">
                                    Join Room
                                </button>
                            </div>

                            {/* Available Rooms List */}
                            <div className="rooms-section">
                                <div className="rooms-header">
                                    <h3 className="rooms-title">Available Rooms</h3>
                                    <button onClick={loadAvailableRooms} disabled={isLoadingRooms} className="btn-refresh">
                                        Refresh
                                    </button>
                                    <button onClick={joinRandomRoom} disabled={isLoadingRooms || isInQueue} className="btn-random">
                                        Random
                                    </button>
                                </div>

                                {isLoadingRooms ? (
                                    <div className="rooms-empty">Loading...</div>
                                ) : availableRooms.length > 0 ? (
                                    <div className="rooms-list">
                                        {availableRooms.map(room => (
                                            <div key={room.roomId} className="room-item">
                                                <div className="room-info">
                                                    <div>
                                                        <p className="room-label">Room ID</p>
                                                        <p className="room-id">{room.roomId}</p>
                                                    </div>
                                                    <div>
                                                        <p className="room-label">Created by</p>
                                                        <p className="room-creator">{room.createdBy}</p>
                                                    </div>
                                                    <div>
                                                        <p className="room-label">Players</p>
                                                        <p className="room-players">{room.players}/2</p>
                                                    </div>
                                                    {room.spectatorCount > 0 && (
                                                        <div>
                                                            <p className="room-label">Watching</p>
                                                            <p className="room-players">👁 {room.spectatorCount}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="room-actions">
                                                    {/* Only show Join for waiting rooms */}
                                                    {room.status === 'waiting' && (
                                                        <button
                                                            onClick={() => joinRoom(room.roomId)}
                                                            disabled={!playerName.trim() || isInQueue}
                                                            className="btn btn-join"
                                                        >
                                                            Join
                                                        </button>
                                                    )}
                                                    {/* Show Watch for in-progress or paused rooms */}
                                                    {(room.status === 'playing' || room.status === 'paused') && (
                                                        <button
                                                            onClick={() => watchRoom(room.roomId)}
                                                            disabled={!playerName.trim()}
                                                            className="btn-watch"
                                                        >
                                                            👁 Watch
                                                        </button>
                                                    )}
                                                    {/* Show status badge for in-progress or paused */}
                                                    {room.status === 'playing' && (
                                                        <span className="room-status-playing">In Progress</span>
                                                    )}
                                                    {room.status === 'paused' && (
                                                        <span className="room-status-paused">⏸ Paused</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rooms-empty">
                                        No available rooms. Create one to get started!
                                    </div>
                                )}
                            </div>
                        </div>

                    ) : (
                        /* ===== GAME AREA ===== */
                        <div className="game-area">

                            {/* Room Info Card */}
                            <div className="card room-info-card">
                                <div className="room-header">
                                    <div>
                                        <p className="info-label">Room ID</p>
                                        <div className="room-id-row">
                                            <p className="room-id-big">{roomId}</p>
                                            <button onClick={copyRoomId} className="btn-copy">📋</button>
                                        </div>
                                    </div>
                                    <div className="color-badge">
                                        <p className="info-label">You are</p>
                                        <div className="color-display">
                                            <span className={`color-circle ${myColor}`} />
                                            <p className="color-text">{myColor === 'white' ? 'White' : 'Black'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="players-row">
                                    <div className="player-box">
                                        <p className="player-label">You</p>
                                        <p className="player-name">{playerName}</p>
                                    </div>
                                    <div className="player-box">
                                        <p className="player-label">Opponent</p>
                                        <p className="player-name">{opponent || 'Waiting...'}</p>
                                    </div>
                                    {spectatorCount > 0 && (
                                        <div className="player-box spectator-pill">
                                            <p className="player-label">Spectators</p>
                                            <p className="player-name">👁 {spectatorCount}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Opponent Disconnected Banner */}
                            {opponentDisconnected && !winner && !isDraw && (
                                <div className="card pause-banner">
                                    <p className="pause-text">Game Paused — Opponent disconnected</p>
                                    <p className="pause-subtext">Waiting for reconnection...</p>
                                </div>
                            )}

                            {/* Status Bar / Winner Banner */}
                            {isDraw ? (
                                <div className="card winner-banner">
                                    <p className="winner-text">It's a Draw!</p>
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                        {currentTurn !== myColor ? 'You have' : 'Opponent has'} no moves left.
                                    </p>
                                    <div className="winner-actions">
                                        <button onClick={backToLobby} className="btn btn-primary">
                                            Back to Lobby
                                        </button>
                                    </div>
                                </div>
                            ) : winner ? (
                                <div className="card winner-banner">
                                    <p className="winner-text">
                                        {winner === myColor ? 'You Win!' : 'You Lose'}
                                    </p>
                                    <div className="winner-actions">
                                        <button onClick={backToLobby} className="btn btn-primary">
                                            Back to Lobby
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="card status-bar">
                                    <span className={`turn-indicator ${isMyTurn ? 'active' : ''}`} />
                                    <p className="turn-text">
                                        {isMyTurn ? "Your Turn" : "Opponent's Turn"}
                                    </p>
                                </div>
                            )}

                            {/* Game Board */}
                            <div className="card board-card">
                                <div className="board">
                                    {board.map((piece, index) => {
                                        const { row, col } = indexToRowCol(index);
                                        const isDark = (row + col) % 2 === 1;
                                        const isSelected = selectedPiece === index;
                                        const isValidMove = validMoves.some(m => m.to === index);
                                        const isClickable =
                                            isMyTurn &&
                                            !winner &&
                                            opponent &&
                                            !opponentDisconnected &&
                                            piece?.color === myColor;

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleSquareClick(index)}
                                                disabled={!opponent || !!winner || isDraw || opponentDisconnected}
                                                className={`
                                                    square
                                                    ${isDark ? 'dark' : 'light'}
                                                    ${isSelected ? 'selected' : ''}
                                                    ${isValidMove ? 'valid-move' : ''}
                                                    ${isClickable ? 'clickable' : ''}
                                                `.trim()}
                                            >
                                                {renderPiece(piece)}
                                                {isValidMove && <span className="move-indicator" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                <p className="board-hint">
                                    {!opponent
                                        ? 'Waiting for opponent to join...'
                                        : opponentDisconnected
                                            ? 'Game paused — waiting for opponent...'
                                            : 'Click your piece to select · Click highlighted square to move'}
                                </p>
                            </div>

                            {/* Leave Room Button */}
                            {!winner && !isDraw && (
                                <button onClick={leaveRoom} className="btn btn-leave">
                                    Leave Game
                                </button>
                            )}

                        </div>
                    )}

                </div>
            </div>
        </SharedLayout>
    );
}