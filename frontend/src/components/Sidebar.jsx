import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Sidebar.css';

const Sidebar = ({
  user,
  activeView,
  onNavClick,
  sidebarOpen,
  setSidebarOpen,
  totalRequestsCount,
  actionableCount,
  pendingFriendCount,
  unreadChatCount,
  onShowInvites,
  onShowProfile,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const username = user?.login || 'user';
  const avatarUrl = user?.customAvatar || user?.avatar || user?.image?.link || user?.image?.versions?.medium;
  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <div className="logo">
          <div className="logo-icon">21</div>
          <div className="logo-text">Project Hub</div>
        </div>

        <nav className="nav-section">
          <a href="#" className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavClick('dashboard'); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            <span>Dashboard</span>
          </a>
          {totalRequestsCount > 0 && (
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); onShowInvites(); setSidebarOpen(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 17H2a3 3 0 003-3V9a7 7 0 0114 0v5a3 3 0 003 3zm-8.27 4a2 2 0 01-3.46 0" /></svg>
              <span>Requests</span>
              <span className="badge">{actionableCount > 0 ? actionableCount : totalRequestsCount}</span>
            </a>
          )}
          <a href="#" className={`nav-item ${activeView === 'friends' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavClick('friends'); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            <span>Friends</span>
            {pendingFriendCount > 0 && <span className="badge">{pendingFriendCount}</span>}
          </a>
        </nav>

        <div className="nav-divider"></div>
        <nav className="nav-section">
          <a href="#" className={`nav-item ${activeView === 'chat' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavClick('chat'); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            <span>Chat</span>
            {unreadChatCount > 0 && <span className="badge badge-chat">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>}
          </a>
          <a href="#" className={`nav-item ${activeView === 'games' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/game'); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="8" cy="12" r="2" /><line x1="14" y1="10" x2="14" y2="10.01" /><line x1="18" y1="12" x2="18" y2="12.01" /><line x1="16" y1="14" x2="16" y2="14.01" /></svg>
            <span>Games</span>
          </a>
        </nav>

        <div className="user-profile" ref={userMenuRef}>
          {avatarUrl ? <img src={avatarUrl} alt={username} className="user-avatar-img" /> : <div className="user-avatar">{getInitials(username)}</div>}
          <div className="user-info">
            {user?.nickname && <div className="user-nickname">{user.nickname}</div>}
            <div className="user-login">@{username}</div>
          </div>
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="logout-dots" title="Options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
          </button>
          {showUserMenu && (
            <div className="user-dropdown">
              <button className="dropdown-item" onClick={() => { onShowProfile(); setShowUserMenu(false); setSidebarOpen(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                Profile
              </button>
              <div className="dropdown-divider"></div>
              <button className="dropdown-item dropdown-danger" onClick={() => { onLogout(); setShowUserMenu(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;