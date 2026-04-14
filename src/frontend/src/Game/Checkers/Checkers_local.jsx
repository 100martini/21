import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Checkers_local.css';
import SharedLayout from '../SharedLayout';

const CheckersLocal = () => {
    const user = (() => { try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; } })();

    // Game State
    const [board, setBoard] = useState(Array(64).fill(null));
    const [turn, setTurn] = useState('white');
    const [selectedPiece, setSelectedPiece] = useState(null); // index
    const [validMoves, setValidMoves] = useState([]);         // [{ to, captured? }]
    const [winner, setWinner] = useState(null);
    const [isDraw, setIsDraw] = useState(false);

    // Setup State
    const [gameStarted, setGameStarted] = useState(false);
    const [player1Name, setPlayer1Name] = useState("Player 1");
    const [player2Name, setPlayer2Name] = useState("Player 2");
    const [setupError, setSetupError] = useState("");
    const [drawLoser, setDrawLoser] = useState(null); // color of player with no moves

    // ── Initialize ──────────────────────────────────────────────────────────────
    const initializeGame = () => {
        const newBoard = Array(64).fill(null);
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 !== 0) {
                    if (row < 3) newBoard[row * 8 + col] = { color: 'black', isKing: false };
                    else if (row > 4) newBoard[row * 8 + col] = { color: 'white', isKing: false };
                }
            }
        }
        setBoard(newBoard);
        setTurn('white');
        setSelectedPiece(null);
        setValidMoves([]);
        setWinner(null);
        setIsDraw(false);
        setDrawLoser(null);
    };

    const startGame = () => {
        if (player1Name.trim() && player2Name.trim()) {
            setSetupError("");
            setGameStarted(true);
            initializeGame();
        } else {
            setSetupError("Please enter both player names");
        }
    };

    // Fully reset game state then show setup screen
    const goToSetup = () => {
        setBoard(Array(64).fill(null));
        setTurn('white');
        setSelectedPiece(null);
        setValidMoves([]);
        setWinner(null);
        setIsDraw(false);
        setDrawLoser(null);
        setGameStarted(false);
    };

    // ── Has Any Moves ───────────────────
    const hasAnyMoves = (currentBoard, color) => {
        for (let i = 0; i < 64; i++) {
            if (currentBoard[i]?.color === color && getValidMoves(i, currentBoard, color).length > 0)
                return true;
        }
        return false;
    };

    // ── Valid Moves ───────────────────
    const getValidMoves = (index, currentBoard = board, currentTurn = turn) => {
        const piece = currentBoard[index];
        if (!piece) return [];

        const row = Math.floor(index / 8);
        const col = index % 8;
        const moves = [];

        // White moves up (-1), Black moves down (+1), Kings move both
        const directions = [];
        if (currentTurn === 'white') {
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

                if (!currentBoard[target]) {
                    moves.push({ to: target });
                } else {
                    // Check for capture
                    const captureRow = row + direction[0] * 2;
                    const captureCol = col + direction[1] * 2;

                    if (captureRow >= 0 && captureRow < 8 && captureCol >= 0 && captureCol < 8) {
                        const captureTarget = captureRow * 8 + captureCol;
                        if (!currentBoard[captureTarget]) {
                            const enemyPiece = currentBoard[target];
                            if ((currentTurn === 'white' && enemyPiece.color === 'black') ||
                                (currentTurn === 'black' && enemyPiece.color === 'white')) {
                                moves.push({ to: captureTarget, captured: target });
                            }
                        }
                    }
                }
            }
        });

        return moves;
    };

    // ── Click handler ───────────────────────────────────────────────────────────
    const handleSquareClick = (index) => {
        if (winner || isDraw || !gameStarted) return;

        const piece = board[index];
        const isValidMove = validMoves.some(m => m.to === index);

        // Clicking a valid-move square → execute move
        if (isValidMove) {
            const move = validMoves.find(m => m.to === index);
            executeMove(move);
            return;
        }

        // Clicking a piece → select it (if it's the current player's)
        if (piece && piece.color === turn) {
            const moves = getValidMoves(index);
            setSelectedPiece(index);
            setValidMoves(moves);
            return;
        }

        // Clicking elsewhere → deselect
        setSelectedPiece(null);
        setValidMoves([]);
    };

    // ── Execute move ────────────────────────────────────────────────────────────
    const executeMove = (move) => {
        const newBoard = [...board];
        const piece = { ...newBoard[selectedPiece] };
        const { to, captured } = move;

        // Move piece
        newBoard[to] = piece;
        newBoard[selectedPiece] = null;

        // Handle capture
        if (captured !== undefined) {
            newBoard[captured] = null;
        }

        // King promotion
        const toRow = Math.floor(to / 8);
        if ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
            newBoard[to] = { ...newBoard[to], isKing: true };
        }

        // Clear selection
        setSelectedPiece(null);
        setValidMoves([]);

        // Switch turn
        const nextTurn = turn === 'white' ? 'black' : 'white';

        // Check winner
        const whitePieces = newBoard.filter(p => p?.color === 'white').length;
        const blackPieces = newBoard.filter(p => p?.color === 'black').length;

        setBoard(newBoard);

        if (whitePieces === 0) { setWinner('Black'); }
        else if (blackPieces === 0) { setWinner('White'); }
        else if (!hasAnyMoves(newBoard, nextTurn)) { setIsDraw(true); setDrawLoser(nextTurn); }
        else { setTurn(nextTurn); }
    };

    // ── Scores ───────────────────────────────────────────────────────────────────
    const whiteScore = board.filter(p => p?.color === 'white').length;
    const blackScore = board.filter(p => p?.color === 'black').length;

    const indexToRowCol = (index) => ({ row: Math.floor(index / 8), col: index % 8 });

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <SharedLayout user={user}>
            <div className="checkers-local-wrapper">
                <div className="game-container">
                    <div className="game-wrapper">

                        {!gameStarted ? (
                            <>
                                <header className="game-header">
                                    <h1>Checkers</h1>
                                    <p>Setup your game room</p>
                                </header>
                                <div className="card setup-card">
                                    <h2>Player Setup</h2>
                                    <div className="input-group">
                                        <label>Player 1 (White)</label>
                                        <input
                                            type="text"
                                            value={player1Name}
                                            onChange={(e) => setPlayer1Name(e.target.value.slice(0, 10))}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Player 2 (Black)</label>
                                        <input
                                            type="text"
                                            value={player2Name}
                                            onChange={(e) => setPlayer2Name(e.target.value.slice(0, 10))}
                                        />
                                    </div>
                                    <button className="btn btn-primary" onClick={startGame}>
                                        Start Game
                                    </button>
                                    {setupError && (
                                        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
                                            ⚠️ {setupError}
                                        </p>
                                    )}
                                </div>
                                <div className="back-button-container">
                                    <Link to="/checkers" className="back-button">
                                        ← Back to Checkers Menu
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <>
                                <header className="game-header">
                                    <h1>Checkers</h1>
                                    <p>Local Multiplayer Game room</p>
                                </header>
                                <div className="game-area">

                                    {/* Status Card */}
                                    <div className="card status-card">
                                        <div className="player-stats">
                                            <div className={`player-box ${turn === 'white' && !winner ? 'active-white' : ''}`}>
                                                <span>{player1Name}</span>
                                                <strong>White ({whiteScore})</strong>
                                            </div>
                                            <div className={`player-box ${turn === 'black' && !winner ? 'active-black' : ''}`}>
                                                <span>{player2Name}</span>
                                                <strong>Black ({blackScore})</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Winner Card */}
                                    {isDraw && (
                                        <div className="card winner-card">
                                            <h3>It's a Draw!</h3>
                                            <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>
                                                {drawLoser === 'white' ? player1Name : player2Name} has no moves left.
                                            </p>
                                            <div className="btn-group">
                                                <button className="btn btn-primary" onClick={initializeGame}>Play Again</button>
                                                <button className="btn btn-secondary" onClick={goToSetup}>Setup</button>
                                            </div>
                                        </div>
                                    )}

                                    {winner && (
                                        <div className="card winner-card">
                                            <h3>{winner === 'White' ? player1Name : player2Name} Wins!</h3>
                                            <div className="btn-group">
                                                <button className="btn btn-primary" onClick={initializeGame}>Play Again</button>
                                                <button className="btn btn-secondary" onClick={goToSetup}>Setup</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Board Card */}
                                    <div className="card board-card">
                                        <div className="board-grid">
                                            {board.map((piece, index) => {
                                                const { row, col } = indexToRowCol(index);
                                                const isDark = (row + col) % 2 === 1;
                                                const isSelected = selectedPiece === index;
                                                const isValidMove = validMoves.some(m => m.to === index);

                                                return (
                                                    <div
                                                        key={index}
                                                        className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''}`}
                                                        onClick={() => handleSquareClick(index)}
                                                    >
                                                        {piece && (
                                                            <div className={`piece ${piece.color} ${piece.isKing ? 'king' : ''}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="back-button-container">
                                        <button onClick={goToSetup} className="back-button" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                            ← Back to Setup
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </SharedLayout>
    );
};

export default CheckersLocal;
