import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { removeToken } from '../utils/auth';
import Sidebar from '../components/Sidebar';
import ProfileModal from '../components/ProfileModal';
import './SharedLayout.css';

const SharedLayout = ({ user, children }) => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    const handleLogout = () => {
        removeToken();
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('welcomeShown');
        sessionStorage.removeItem('dashboardView');
        navigate('/login');
    };

    const handleNavClick = (view) => {
        sessionStorage.setItem('dashboardView', view);
        navigate('/dashboard');
    };

    const handleShowProfile = () => {
        setShowProfile(true);
    };

    const handleShowInvites = () => {
        sessionStorage.setItem('dashboardView', 'dashboard');
        navigate('/dashboard');
    };

    return (
        <div className="full-dashboard-2">
            <div className="mobile-topbar">
                <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <div className="logo-icon">21</div>
                <div className="logo-text">Project Hub</div>
            </div>

            <Sidebar
                user={user}
                activeView="games"
                onNavClick={handleNavClick}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                totalRequestsCount={0}
                actionableCount={0}
                pendingFriendCount={0}
                onShowInvites={handleShowInvites}
                onShowProfile={handleShowProfile}
                onLogout={handleLogout}
            />

            <main className="main">
                {children}
            </main>
            {showProfile && (
                <ProfileModal
                    user={user}
                    onClose={() => setShowProfile(false)}
                    onUserUpdate={(data) => { /* update user state, if necessary, sinon safi skip */ }}
                />
            )}
        </div>
    );
};

export default SharedLayout;
