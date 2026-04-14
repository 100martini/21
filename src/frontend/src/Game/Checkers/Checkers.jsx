import { Link, useNavigate } from "react-router";
import SharedLayout from "../SharedLayout";
import "../styles/Checkers.css";

export default function Checkers() {
    const navigate = useNavigate();
    const user = (() => {
        try { return JSON.parse(sessionStorage.getItem('user')); }
        catch { return null; }
    })();

    return (
        <SharedLayout user={user}>
            <div className="checkers-mode-wrapper">
                <div className="mode-select-container">
                    <div className="mode-select-content">
                        {/* Header */}
                        <header className="mode-select-header">
                            <h1 className="mode-select-title">Checkers</h1>
                            <p className="mode-select-subtitle">Choose your mode and play with your friends</p>
                        </header>

                        {/* Mode Selection Cards */}
                        <div className="mode-cards">
                            {/* Local Mode */}
                            <button
                                onClick={() => navigate('/checkers/local')}
                                className="mode-card"
                            >
                                <div className="mode-card-header">
                                    <div className="mode-icon mode-icon-local">
                                        🎮
                                    </div>
                                    <div className="mode-badge mode-badge-local">
                                        LOCAL
                                    </div>
                                </div>
                                <h2 className="mode-card-title">Play Locally</h2>
                                <p className="mode-card-description">
                                    Play with a friend on the same device. Take turns making moves.
                                </p>
                            </button>

                            {/* Multiplayer Mode */}
                            <button
                                onClick={() => navigate('/checkers/online')}
                                className="mode-card"
                            >
                                <div className="mode-card-header">
                                    <div className="mode-icon mode-icon-online">
                                        🌐
                                    </div>
                                    <div className="mode-badge mode-badge-online">
                                        ONLINE
                                    </div>
                                </div>
                                <h2 className="mode-card-title">Play Online</h2>
                                <p className="mode-card-description">
                                    Create or join a room to play with friends online in real-time.
                                </p>
                            </button>
                        </div>

                        {/* Back Button */}
                        <div className="back-button-container">
                            <Link to="/game" className="back-button">
                                ← Back to Games Hub
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </SharedLayout>
    );
}