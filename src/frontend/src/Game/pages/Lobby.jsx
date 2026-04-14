import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SharedLayout from '../SharedLayout';
import '../styles/Looby.css';

function Bar({ wins, played, color }) {
    const pct = played > 0 ? (wins / played) * 100 : 0;
    return (
        <div className="stats-progress-container">
            <div className="stats-progress-bar" style={{
                width: `${pct}%`,
                background: color,
                boxShadow: `0 0 8px ${color}88`,
            }} />
        </div>
    );
}

export default function Lobby() {
    const [user] = useState(() => {
        try {
            const str = sessionStorage.getItem('user');
            return str ? JSON.parse(str) : null;
        } catch { return null; }
    });

    const [usersData, setUsersData] = useState([]);
    const [gameHistory, setGameHistory] = useState([]);
    const [activeView, setActiveView] = useState('stats'); // 'leaderboard' | 'history' | 'stats'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const serverUrl = import.meta.env.VITE_CHECKERS_SOCKET_URL || 'http://localhost:3001';

        Promise.all([
            fetch(`${serverUrl}/users`).then(r => r.json()),
            fetch(`${serverUrl}/gameHistory`).then(r => r.json()),
        ])
            .then(([users, history]) => {
                setUsersData(users);
                setGameHistory(
                    [...history].sort((a, b) =>
                        a.playedAt && b.playedAt ? new Date(b.playedAt) - new Date(a.playedAt) : 0
                    )
                );
            })
            .catch(() => {
                setUsersData([]);
                setGameHistory([]);
            })
            .finally(() => setLoading(false));
    }, []);

    const leaderboard = [...usersData]
        .map(u => ({
            ...u,
            totalWins: (u.tictactoeWins || 0) + (u.checkersWins || 0),
            totalPlayed: (u.tictactoePlayed || 0) + (u.checkersPlayed || 0),
            winRate: ((u.tictactoePlayed || 0) + (u.checkersPlayed || 0)) > 0
                ? Math.round((((u.tictactoeWins || 0) + (u.checkersWins || 0)) /
                    ((u.tictactoePlayed || 0) + (u.checkersPlayed || 0))) * 100)
                : 0,
        }))
        .filter(u => u.totalPlayed > 0)
        .sort((a, b) => b.totalWins - a.totalWins);

    const rawMyStats = usersData.find(u => u.username === user?.login);
    const myStats = rawMyStats ? {
        ...rawMyStats,
        totalWins: (rawMyStats.tictactoeWins || 0) + (rawMyStats.checkersWins || 0),
        totalPlayed: (rawMyStats.tictactoePlayed || 0) + (rawMyStats.checkersPlayed || 0),
        winRate: ((rawMyStats.tictactoePlayed || 0) + (rawMyStats.checkersPlayed || 0)) > 0
            ? Math.round((((rawMyStats.tictactoeWins || 0) + (rawMyStats.checkersWins || 0)) /
                ((rawMyStats.tictactoePlayed || 0) + (rawMyStats.checkersPlayed || 0))) * 100)
            : 0,
    } : {
        username: user?.login,
        totalWins: 0, totalPlayed: 0, winRate: 0,
        tictactoePlayed: 0, tictactoeWins: 0, tictactoeLosses: 0, tictactoeDraws: 0,
        checkersPlayed: 0, checkersWins: 0, checkersLosses: 0, checkersDraws: 0,
    };

    const login = user?.login?.toLowerCase();
    const myHistory = gameHistory.filter(g =>
        g.player1?.toLowerCase() === login || g.player2?.toLowerCase() === login
    );

    return (
        <SharedLayout user={user}>
            <div className="game-lobby-wrapper">
                <div className="home-container" style={{ padding: 0, backgroundColor: 'transparent', minHeight: 'auto' }}>
                    <div className="home-content">

                        {/* Header */}
                        <div className="home-header">
                            <div className="header-text">
                                <h1 className="home-title">Game Lobby</h1>
                                <p className="home-subtitle">
                                    Welcome back, <strong style={{ color: '#faf0e6' }}>{user?.login ?? 'Player'}</strong> — pick a game and start playing.
                                </p>
                            </div>
                        </div>

                        {/* Games Grid */}
                        <div className="games-grid">
                            <Link to="/tictactoe" className="game-card-link">
                                <div className="game-card">
                                    <div className="game-card-header">
                                        <div className="game-icon game-icon-tictactoe">⭕</div>
                                        <div className="game-badge">2 players</div>
                                    </div>
                                    <h2 className="game-title">Tic Tac Toe</h2>
                                    <p className="game-description">You can at best tie and at worst lose.</p>
                                </div>
                            </Link>

                            <Link to="/checkers" className="game-card-link">
                                <div className="game-card">
                                    <div className="game-card-header">
                                        <div className="game-icon game-icon-checkers">🎲</div>
                                        <div className="game-badge">2 players</div>
                                    </div>
                                    <h2 className="game-title">Checkers</h2>
                                    <p className="game-description">Jump your way to victory in this game.</p>
                                </div>
                            </Link>

                            {/* coming soon */}
                            <div className="game-card-link" style={{ cursor: 'default' }}>
                                <div className="game-card disabled">
                                    <div className="game-card-header">
                                        <div className="game-icon game-icon-chess">♟</div>
                                        <div className="game-badge">Coming Soon</div>
                                    </div>
                                    <h2 className="game-title">Chess</h2>
                                    <p className="game-description">Play chess against another player.</p>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row: single card with Leaderboard / History / Stats */}
                        <div className="lb-row">
                            <div className="lb-card" style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>

                                {/* Shared header with three view buttons */}
                                <div className="lb-header">
                                    <h3 className="lb-title">
                                        {activeView === 'leaderboard' ? 'Leaderboard' : activeView === 'history' ? 'Game History' : 'Your Stats'}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {['stats', 'history', 'leaderboard'].map(view => (
                                            <button
                                                key={view}
                                                className="lb-switch-btn"
                                                onClick={() => setActiveView(view)}
                                                style={activeView === view ? { background: 'rgba(144,190,109,0.18)', color: '#90be6d', borderColor: '#90be6d55' } : {}}
                                            >
                                                {view.charAt(0).toUpperCase() + view.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Loading state */}
                                {loading && (
                                    <p className="lb-empty" style={{ textAlign: 'center', padding: '1rem 0' }}>Loading…</p>
                                )}

                                {/* ── Leaderboard ── */}
                                {!loading && activeView === 'leaderboard' && (
                                    <>
                                        {leaderboard.length === 0 ? (
                                            <p className="lb-empty">No games played yet.</p>
                                        ) : (
                                            <div className="lb-list">
                                                {leaderboard.map((u, i) => (
                                                    <div key={u.id ?? u.username} className={`lb-item ${i === 0 ? 'lb-first' : ''} ${u.username === user?.login ? 'lb-self' : ''}`}>
                                                        <span className="lb-rank">#{i + 1}</span>
                                                        <span className="lb-name">{u.username === user?.login ? 'You' : u.username}</span>
                                                        <span className="lb-wins">{u.totalWins} wins</span>
                                                        <span className="lb-rate">{u.winRate}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ── Game History ── */}
                                {!loading && activeView === 'history' && (
                                    <>
                                        <div className="lb-list">
                                            {myHistory.length === 0 ? (
                                                <p className="lb-empty">No matches yet.</p>
                                            ) : (
                                                myHistory.map((g, i) => {
                                                    const GAME_META = {
                                                        TICTACTOE: { icon: '⭕', iconBg: 'rgba(185, 180, 199, 0.08)', label: 'Tic Tac Toe' },
                                                        CHECKERS: { icon: '🔴', iconBg: 'rgba(239, 118, 122, 0.08)', label: 'Checkers' },
                                                    };
                                                    const meta = GAME_META[g.gameType] ?? { icon: '🎮', iconBg: 'rgba(255,255,255,0.06)', label: g.gameType };
                                                    const isDraw = g.winner === 'DRAW';
                                                    const p1Won = g.winner === g.player1;
                                                    const p1Name = g.player1?.toLowerCase() === login ? 'You' : g.player1;
                                                    const p2Name = g.player2?.toLowerCase() === login ? 'You' : g.player2;
                                                    const p1IsUser = g.player1?.toLowerCase() === login;
                                                    const p2IsUser = g.player2?.toLowerCase() === login;
                                                    const p1Color = isDraw ? '#b9b4c7' : p1Won ? '#90be6d' : (p1IsUser ? '#ef767a' : '#b9b4c7');
                                                    const p2Color = isDraw ? '#b9b4c7' : p1Won ? (p2IsUser ? '#ef767a' : '#b9b4c7') : '#90be6d';
                                                    let winnerLabel = isDraw ? 'Draw' : `Winner: ${g.winner}`;
                                                    if (g.winner?.toLowerCase() === login) winnerLabel = 'Winner: You';
                                                    const winnerColor = (!isDraw && g.winner?.toLowerCase() !== login && (p1IsUser || p2IsUser))
                                                        ? '#ef767a' : (isDraw ? '#b9b4c7' : '#90be6d');
                                                    return (
                                                        <div key={g.id ?? i} className="match-row">
                                                            <div className="match-icon" style={{ background: meta.iconBg }}>{meta.icon}</div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div className="match-game">{meta.label}</div>
                                                                <div className="match-players">
                                                                    <span style={{ color: p1Color }}>{p1Name}</span>
                                                                    <span style={{ color: '#5c5470' }}> vs </span>
                                                                    <span style={{ color: p2Color }}>{p2Name}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                <div className="match-winner" style={{ color: winnerColor }}>{winnerLabel}</div>
                                                                {g.time && <div className="match-time">{g.time}</div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* ── My Stats ── */}
                                {!loading && activeView === 'stats' && myStats && (
                                    <>
                                        <div className="stats-ambient-glow" />

                                        {/* summary pills */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div className="stats-pills-grid" style={{ flex: 1 }}>
                                                {[
                                                    { label: 'Played', value: myStats.totalPlayed, color: '#b9b4c7' },
                                                    { label: 'Wins', value: myStats.totalWins, color: '#90be6d' },
                                                    { label: 'Losses', value: (myStats.tictactoeLosses || 0) + (myStats.checkersLosses || 0), color: '#ef767a' },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} className="stats-pill">
                                                        <div className="stats-pill-val" style={{ color }}>{value}</div>
                                                        <div className="stats-pill-label">{label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="stats-divider" />

                                        {/* per-game breakdown */}
                                        {[
                                            {
                                                icon: '⭕', label: 'Tic Tac Toe',
                                                accentBg: 'rgba(185,180,199,0.1)',
                                                stats: [
                                                    { key: 'Played', val: myStats.tictactoePlayed || 0 },
                                                    { key: 'Wins', val: myStats.tictactoeWins || 0, color: '#90be6d' },
                                                    { key: 'Losses', val: myStats.tictactoeLosses || 0, color: '#ef767a' },
                                                    { key: 'Draws', val: myStats.tictactoeDraws || 0, color: '#f9c74f' },
                                                ],
                                                wins: myStats.tictactoeWins || 0, played: myStats.tictactoePlayed || 0, barColor: '#b9b4c7',
                                            },
                                            {
                                                icon: '🔴', label: 'Checkers',
                                                accentBg: 'rgba(239,118,122,0.1)',
                                                stats: [
                                                    { key: 'Played', val: myStats.checkersPlayed || 0 },
                                                    { key: 'Wins', val: myStats.checkersWins || 0, color: '#90be6d' },
                                                    { key: 'Losses', val: myStats.checkersLosses || 0, color: '#ef767a' },
                                                    { key: 'Draws', val: myStats.checkersDraws || 0, color: '#f9c74f' },
                                                ],
                                                wins: myStats.checkersWins || 0, played: myStats.checkersPlayed || 0, barColor: '#ef767a',
                                            },
                                        ].map((game) => (
                                            <div key={game.label} style={{ marginBottom: '1.1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div className="stats-game-icon" style={{ background: game.accentBg }}>{game.icon}</div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div className="stats-game-header">
                                                            <span className="stats-game-title">{game.label}</span>
                                                            <div className="stats-game-details">
                                                                {game.stats.map(s => (
                                                                    <span key={s.key} style={{ fontSize: '0.72rem', color: s.color ?? '#5c5470' }}>
                                                                        <span style={{ color: s.color ?? '#b9b4c7', fontWeight: 700 }}>{s.val}</span>
                                                                        {' '}{s.key}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <Bar wins={game.wins} played={game.played} color={game.barColor} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </SharedLayout>
    );
}
