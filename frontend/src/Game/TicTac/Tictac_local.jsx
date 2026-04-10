import React, { useState } from "react";
import "../styles/Tictac_local.css";
import { useNavigate, Link } from "react-router-dom";
import SharedLayout from "../SharedLayout";

export default function TicTacToeLocal() {
    const navigate = useNavigate();
    const user = (() => { try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; } })();
    const [board, setBoard] = useState(Array(9).fill(null));
    const [currentPlayer, setCurrentPlayer] = useState("X");
    const [winner, setWinner] = useState(null);
    const [player1Name, setPlayer1Name] = useState("Player 1");
    const [player2Name, setPlayer2Name] = useState("Player 2");
    const [gameStarted, setGameStarted] = useState(false);
    const [setupError, setSetupError] = useState("");

    const calculateWinner = (squares) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6], // diagonals
        ];
        for (const [a, b, c] of lines) {
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return null;
    };

    const makeMove = (index) => {
        if (!gameStarted || board[index] || winner) return;

        const newBoard = [...board];
        newBoard[index] = currentPlayer;
        const gameWinner = calculateWinner(newBoard);

        setBoard(newBoard);

        if (gameWinner) {
            setWinner(gameWinner);
        } else if (newBoard.every((cell) => cell !== null)) {
            setWinner("draw");
        } else {
            setCurrentPlayer(currentPlayer === "X" ? "O" : "X");
        }
    };

    const resetGame = () => {
        setBoard(Array(9).fill(null));
        setCurrentPlayer("X");
        setWinner(null);
    };

    const startGame = () => {
        if (player1Name.trim() && player2Name.trim()) {
            setSetupError("");
            setGameStarted(true);
        } else {
            setSetupError("Please enter both player names");
        }
    };

    return (
        <SharedLayout user={user}>
            <div className="tictac-local-wrapper">
                <div className="game-container">
                    <div className="game-wrapper">

                        {!gameStarted ? (
                            <>
                                <header className="game-header">
                                    <h1>Tic Tac Toe</h1>
                                    <p>Setup your game room</p>
                                </header>
                                <div className="card setup-card">
                                    <h2>Player Setup</h2>
                                    <div className="input-group">
                                        <label>Player 1 (X)</label>
                                        <input
                                            type="text"
                                            value={player1Name}
                                            onChange={(e) => setPlayer1Name(e.target.value.slice(0, 10))}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Player 2 (O)</label>
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
                                    <Link to="/tictactoe" className="back-button">
                                        ← Back to Tic Tac Toe
                                    </Link>
                                </div>
                            </>

                        ) : (

                            <>
                                <header className="game-header">
                                    <h1>Tic Tac Toe</h1>
                                    <p>Local Multiplayer Game room</p>
                                </header>

                                <div className="game-area">
                                    <div className="card status-card">
                                        <div className="player-stats">
                                            <div className={`player-box ${currentPlayer === 'X' && !winner ? 'active-x' : ''}`}>
                                                <span>{player1Name}</span>
                                                <strong>X</strong>
                                            </div>
                                            <div className={`player-box ${currentPlayer === 'O' && !winner ? 'active-o' : ''}`}>
                                                <span>{player2Name}</span>
                                                <strong>O</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {winner && (
                                        <div className="card winner-card">
                                            <h3>{winner === "draw" ? "It's a Draw!" : `${winner === 'X' ? player1Name : player2Name} Wins!`}</h3>
                                            <div className="btn-group">
                                                <button className="btn btn-primary" onClick={resetGame}>Play Again</button>
                                                <button className="btn btn-secondary" onClick={() => { setGameStarted(false); resetGame(); }}>Setup</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="card board-card">
                                        <div className="board-grid">
                                            {board.map((cell, i) => (
                                                <button
                                                    key={i}
                                                    className={`cell ${cell ? 'filled' : ''} ${cell === 'X' ? 'x-color' : cell === 'O' ? 'o-color' : ''}`}
                                                    onClick={() => makeMove(i)}
                                                    disabled={!!cell || !!winner}
                                                >
                                                    {cell}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Back Button */}
                                    <div className="back-button-container">
                                        <button onClick={() => { setGameStarted(false); resetGame(); }} className="back-button">
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
}