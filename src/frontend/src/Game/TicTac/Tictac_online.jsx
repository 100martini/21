import { useState, useEffect, useRef } from "react";
import { getSocket, saveSession, clearSession, getSavedSession, pauseSocket } from "./socket";
import "../styles/Tictac_online.css";
import SharedLayout from "../SharedLayout";

export default function TicTacToeMultiplayer() {
    // Read user once from sessionStorage — not on every render
    const [user] = useState(() => {
        try {
            const str = sessionStorage.getItem('user');
            return str ? JSON.parse(str) : {};
        } catch {
            return {};
        }
    });

    const [isConnected, setIsConnected] = useState(false);
    const [playerName, setPlayerName] = useState(user.login || "");
    const [roomId, setRoomId] = useState("");
    const [isInRoom, setIsInRoom] = useState(false);
    const [mySymbol, setMySymbol] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);

    // Game State
    const [board, setBoard] = useState(Array(9).fill(null));
    const [currentTurn, setCurrentTurn] = useState('X');
    const [winner, setWinner] = useState(null);
    const [isDraw, setIsDraw] = useState(false);
    const [winningLine, setWinningLine] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);

    // Reconnection State
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);

    // Spectator State
    const [isSpectating, setIsSpectating] = useState(false);
    const [spectatorCount, setSpectatorCount] = useState(0);
    const [spectatingRoomId, setSpectatingRoomId] = useState("");
    const [spectatingPlayers, setSpectatingPlayers] = useState({ X: '', O: '' });

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
            console.log('Socket connected:', socket.id);
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
            setIsDraw(gameState.isDraw);
            setWinningLine(gameState.winningLine);
            setSpectatorCount(gameState.spectatorCount || 0);

            const me = gameState.players.find(p => p.socketId === socket.id);
            const opp = gameState.players.find(p => p.socketId !== socket.id);
            if (me) {
                setMySymbol(me.symbol);
                setIsMyTurn(me.symbol === gameState.currentTurn && !gameState.winner && !gameState.isDraw);
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
                showNotification(`${playerName} disconnected. Waiting ${seconds}s for reconnection...`, 5000);
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
            setMySymbol('X');
            setBoard(state.board);
            setCurrentTurn(state.currentTurn);
            setIsMyTurn(state.currentTurn === 'X');
            setSpectatorCount(0);
            saveSession(state.id, playerName, 'X');
        });

        socket.on('roomUpdated', (state) => {
            setIsInRoom(true);
            updateGameState(state);
            const opponentPlayer = state.players.find(p => p.socketId !== socket.id);
            if (opponentPlayer) setOpponent(opponentPlayer.name);
            const me = state.players.find(p => p.socketId === socket.id);
            if (me) saveSession(state.id, playerName, me.symbol);
        });

        socket.on('gameStart', (state) => {
            console.log('Game started!');
            updateGameState(state);
            const me = state.players.find(p => p.socketId === socket.id);
            if (me) {
                setMySymbol(me.symbol);
                setIsMyTurn(me.symbol === state.currentTurn);
            }
        });

        socket.on('moveMade', ({ state }) => {
            updateGameState(state);
        });

        socket.on('gameReset', (state) => {
            updateGameState(state);
        });



        socket.on('opponentLeft', ({ playerName, winner: winnerSymbol }) => {
            if (!isSpectatingRef.current) {
                showNotification(`${playerName} left. You win!`, 5000);
            }
            if (winnerSymbol) setWinner(winnerSymbol);
        });

        socket.on('error', ({ message }) => {
            showNotification(`⚠️ ${message}`, 4000);
        });

        // ── Spectator events ───────────────────────────────────────────────────
        socket.on('watchConfirmed', (state) => {
            setIsSpectating(true);
            setSpectatingRoomId(state.id);
            setBoard(state.board);
            setCurrentTurn(state.currentTurn);
            setWinner(state.winner);
            setIsDraw(state.isDraw);
            setWinningLine(state.winningLine);
            setSpectatorCount(state.spectatorCount || 0);

            const xPlayer = state.players.find(p => p.symbol === 'X');
            const oPlayer = state.players.find(p => p.symbol === 'O');
            setSpectatingPlayers({ X: xPlayer?.name || 'Player X', O: oPlayer?.name || 'Player O' });

            // showNotification('👁 Now spectating! Board is read-only.', 4000);
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
            socket.off('watchConfirmed');
            socket.off('spectatorUpdate');
            pauseSocket();
        };
    }, []);

    const handleConnectLogic = (socket) => {
        const saved = getSavedSession();
        if (saved && saved.roomId) {
            setIsReconnecting(true);
            showNotification('🔄 Attempting to reconnect...', 10000);
            socket.emit('attemptReconnect', saved);
        } else {
            loadAvailableRooms();
        }
    };

    const updateGameState = (state) => {
        setBoard(state.board);
        setCurrentTurn(state.currentTurn);
        setWinner(state.winner);
        setIsDraw(state.isDraw);
        setWinningLine(state.winningLine);
        if (state.spectatorCount !== undefined) setSpectatorCount(state.spectatorCount);

        const socket = getSocket();
        const me = state.players.find(p => p.socketId === socket.id);
        if (me) {
            setIsMyTurn(me.symbol === state.currentTurn && !state.winner && !state.isDraw);
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
        setBoard(Array(9).fill(null));
        setWinner(null);
        setIsDraw(false);
        setWinningLine(null);
        setOpponent(null);
        setSpectatorCount(0);
        setCurrentTurn('X');
        setSpectatingPlayers({ X: '', O: '' });
        loadAvailableRooms();
    };

    const handleCellClick = (index) => {
        if (isSpectating) return;
        if (!isMyTurn || winner || isDraw || !opponent || board[index] || opponentDisconnected) return;
        const socket = getSocket();
        socket.emit('makeMove', { roomId, position: index });
    };

    const resetGame = () => {
        clearSession();
        setIsInRoom(false);
        setRoomId("");
        setBoard(Array(9).fill(null));
        setCurrentTurn('X');
        setWinner(null);
        setIsDraw(false);
        setWinningLine(null);
        setMySymbol(null);
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

    const isWinningCell = (index) => winningLine && winningLine.includes(index);

    return (
        <SharedLayout user={user.login ? user : null}>
            <div className="tictac-multiplayer">
                <div className="tm-container">

                    {/* Notification Toast */}
                    {notification && <div className="tm-toast">{notification}</div>}

                    {/* Reconnecting Overlay */}
                    {isReconnecting && (
                        <div className="tm-reconnecting-overlay">
                            <div className="tm-spinner" />
                            <p>Reconnecting to game...</p>
                        </div>
                    )}

                    {/* Header */}
                    <header className="tm-header">
                        <a href="/tictactoe" className="tm-back-btn" aria-label="Back">
                            <span>←</span>
                        </a>
                        <div>
                            <h1 className="tm-title">Tic-Tac-Toe — Online</h1>
                            <p className="tm-subtitle">Play online with friends</p>
                        </div>
                    </header>

                    {/* Connection Status */}
                    <div className="tm-connection-status">
                        <span className={`tm-status-dot ${isReconnecting ? 'reconnecting' :
                            isConnected ? 'connected' : 'disconnected'}`} />
                        <span className="tm-status-text">
                            {isReconnecting ? 'Reconnecting...'
                                : isConnected ? 'Connected to server'
                                    : 'Disconnected - Check server'}
                        </span>
                    </div>

                    {/* ===== SPECTATOR VIEW ===== */}
                    {isSpectating ? (
                        <div className="tm-game-area">
                            {/* Spectator badge */}
                            <div className="tm-spectator-badge">
                                <span className="tm-spectator-eye">👁</span>
                                <span>Spectating</span>
                                <span className="tm-spectator-count">{spectatorCount} watching</span>
                            </div>

                            {/* Room Info */}
                            <div className="tm-card tm-room-info-card">
                                <div className="tm-room-top">
                                    <div>
                                        <p className="tm-info-label">Room ID</p>
                                        <p className="tm-room-id-big">{spectatingRoomId}</p>
                                    </div>
                                    <div className="tm-symbol-badge">
                                        <p className="tm-info-label">Turn</p>
                                        <div className="tm-symbol-display">
                                            <span className={`tm-symbol-text ${currentTurn === 'X' ? 'x-color' : 'o-color'}`}>
                                                {currentTurn}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="tm-players-row">
                                    <div className="tm-player-box">
                                        <p className="tm-player-label">✕ X</p>
                                        <p className="tm-player-name">{spectatingPlayers.X}</p>
                                    </div>
                                    <div className="tm-player-box">
                                        <p className="tm-player-label">○ O</p>
                                        <p className="tm-player-name">{spectatingPlayers.O}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Status / Winner */}
                            {winner || isDraw ? (
                                <div className="tm-card tm-winner-banner">
                                    <p className="tm-winner-text">
                                        {isDraw ? "It's a Draw!"
                                            : `${spectatingPlayers[winner] || winner} Wins!`}
                                    </p>
                                    <div className="tm-winner-actions">
                                        <button onClick={stopWatching} className="tm-btn tm-btn-secondary">
                                            Back to Lobby
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="tm-card tm-status-bar">
                                    <span className="tm-turn-indicator active" />
                                    <p className="tm-turn-text">
                                        {`${spectatingPlayers[currentTurn] || currentTurn}'s Turn`}
                                    </p>
                                </div>
                            )}

                            {/* Board — read-only */}
                            <div className="tm-card tm-board-card">
                                <div className="tm-board-grid">
                                    {board.map((cell, index) => (
                                        <button
                                            key={index}
                                            disabled
                                            className={`tm-cell
                                                ${cell === 'X' ? 'x-color' : ''}
                                                ${cell === 'O' ? 'o-color' : ''}
                                                ${isWinningCell(index) ? 'winning' : ''}
                                            `.trim()}
                                        >
                                            {cell}
                                        </button>
                                    ))}
                                </div>
                                <p className="tm-board-hint">You are spectating — board is read-only</p>
                            </div>

                            <button onClick={stopWatching} className="tm-btn-leave">
                                Stop Watching
                            </button>
                        </div>

                    ) : !isInRoom ? (
                        /* ===== LOBBY ===== */
                        <div className="tm-card">
                            <h2 className="tm-card-title">Join or Create Room</h2>

                            <div className="tm-form-fields">
                                <div>
                                    <label className="tm-field-label">Your Name</label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        placeholder="Enter your name"
                                        className="tm-field-input"
                                        readOnly={!!user.login}
                                    />
                                </div>
                                <div>
                                    <label className="tm-field-label">Room ID (to join existing)</label>
                                    <input
                                        type="text"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                        placeholder="Enter room ID"
                                        className="tm-field-input"
                                    />
                                </div>
                            </div>

                            <div className="tm-btn-row">
                                <button onClick={createRoom} disabled={!isConnected} className="tm-btn tm-btn-primary">
                                    Create New Room
                                </button>
                                <button onClick={() => joinRoom()} disabled={!isConnected || !roomId.trim()} className="tm-btn tm-btn-secondary">
                                    Join Room
                                </button>
                            </div>

                            {/* Available Rooms List */}
                            <div className="tm-rooms-section">
                                <div className="tm-rooms-header">
                                    <h3 className="tm-rooms-title">Available Rooms</h3>
                                    <button onClick={loadAvailableRooms} disabled={isLoadingRooms} className="tm-btn-refresh">
                                        Refresh
                                    </button>
                                </div>

                                {isLoadingRooms ? (
                                    <div className="tm-rooms-empty">Loading...</div>
                                ) : availableRooms.length > 0 ? (
                                    <div className="tm-rooms-list">
                                        {availableRooms.map(room => (
                                            <div key={room.roomId} className="tm-room-item">
                                                <div className="tm-room-meta">
                                                    <div>
                                                        <p className="tm-room-label">Room ID</p>
                                                        <p className="tm-room-id-text">{room.roomId}</p>
                                                    </div>
                                                    <div>
                                                        <p className="tm-room-label">Created by</p>
                                                        <p className="tm-room-val">{room.createdBy}</p>
                                                    </div>
                                                    <div>
                                                        <p className="tm-room-label">Players</p>
                                                        <p className="tm-room-val">{room.players}/2</p>
                                                    </div>
                                                    {room.spectatorCount > 0 && (
                                                        <div>
                                                            <p className="tm-room-label">Watching</p>
                                                            <p className="tm-room-val">👁 {room.spectatorCount}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="tm-room-actions">
                                                    {room.status === 'waiting' && (
                                                        <button
                                                            onClick={() => joinRoom(room.roomId)}
                                                            disabled={!playerName.trim()}
                                                            className="tm-btn-join"
                                                        >
                                                            Join
                                                        </button>
                                                    )}
                                                    {/* show Watch for both playing AND paused rooms */}
                                                    {(room.status === 'playing' || room.status === 'paused') && (
                                                        <button
                                                            onClick={() => watchRoom(room.roomId)}
                                                            disabled={!playerName.trim()}
                                                            className="tm-btn-watch"
                                                        >
                                                            👁 Watch
                                                        </button>
                                                    )}
                                                    {room.status === 'playing' && (
                                                        <span className="tm-room-status-playing">In Progress</span>
                                                    )}
                                                    {room.status === 'paused' && (
                                                        <span className="tm-room-status-paused">⏸ Paused</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="tm-rooms-empty">
                                        No available rooms. Create one to get started!
                                    </div>
                                )}
                            </div>
                        </div>

                    ) : (
                        /* ===== GAME AREA ===== */
                        <div className="tm-game-area">

                            {/* Room Info Card */}
                            <div className="tm-card tm-room-info-card">
                                <div className="tm-room-top">
                                    <div>
                                        <p className="tm-info-label">Room ID</p>
                                        <div className="tm-room-id-row">
                                            <p className="tm-room-id-big">{roomId}</p>
                                            <button onClick={copyRoomId} className="tm-btn-copy">📋</button>
                                        </div>
                                    </div>
                                    <div className="tm-symbol-badge">
                                        <p className="tm-info-label">You are</p>
                                        <div className="tm-symbol-display">
                                            <span className={`tm-symbol-text ${mySymbol === 'X' ? 'x-color' : 'o-color'}`}>
                                                {mySymbol}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="tm-players-row">
                                    <div className="tm-player-box">
                                        <p className="tm-player-label">You</p>
                                        <p className="tm-player-name">{playerName}</p>
                                    </div>
                                    <div className="tm-player-box">
                                        <p className="tm-player-label">Opponent</p>
                                        <p className="tm-player-name">{opponent || 'Waiting...'}</p>
                                    </div>
                                    {spectatorCount > 0 && (
                                        <div className="tm-player-box tm-spectator-pill">
                                            <p className="tm-player-label">Spectators</p>
                                            <p className="tm-player-name">👁 {spectatorCount}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Opponent Disconnected Banner */}
                            {opponentDisconnected && !winner && !isDraw && (
                                <div className="tm-card tm-pause-banner">
                                    <p className="tm-pause-text">Game Paused - Opponent disconnected</p>
                                    <p className="tm-pause-subtext">Waiting for reconnection...</p>
                                </div>
                            )}

                            {/* Status Bar / Winner Banner */}
                            {winner || isDraw ? (
                                <div className="tm-card tm-winner-banner">
                                    <p className="tm-winner-text">
                                        {isDraw ? "It's a Draw!"
                                            : winner === mySymbol ? 'You Win!' : 'You Lose'}
                                    </p>
                                    <div className="tm-winner-actions">
                                        <button onClick={backToLobby} className="tm-btn tm-btn-secondary">
                                            Back to Lobby
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="tm-card tm-status-bar">
                                    <span className={`tm-turn-indicator ${isMyTurn ? 'active' : ''}`} />
                                    <p className="tm-turn-text">
                                        {isMyTurn ? "Your Turn" : "Opponent's Turn"}
                                    </p>
                                </div>
                            )}

                            {/* Game Board */}
                            <div className="tm-card tm-board-card">
                                <div className="tm-board-grid">
                                    {board.map((cell, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleCellClick(index)}
                                            disabled={!opponent || !!winner || isDraw || !!cell || opponentDisconnected}
                                            className={`
                                                tm-cell
                                                ${cell === 'X' ? 'x-color' : ''}
                                                ${cell === 'O' ? 'o-color' : ''}
                                                ${isWinningCell(index) ? 'winning' : ''}
                                                ${isMyTurn && !cell && !winner && !isDraw && opponent && !opponentDisconnected ? 'clickable' : ''}
                                            `.trim()}
                                        >
                                            {cell}
                                        </button>
                                    ))}
                                </div>
                                <p className="tm-board-hint">
                                    {!opponent ? 'Waiting for opponent to join...'
                                        : opponentDisconnected ? 'Game paused - waiting for opponent...'
                                            : isMyTurn ? 'Click any empty cell to make your move'
                                                : "Wait for opponent's move"}
                                </p>
                            </div>

                            {/* Leave Room Button */}
                            {!winner && !isDraw && (
                                <button onClick={leaveRoom} className="tm-btn-leave">
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