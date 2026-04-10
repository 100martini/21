import React, { useState, useRef, useEffect } from 'react';

const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL || 'https://localhost:8443';

export default function ServerSidebar({ onSettingsClick, user }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const avatarUrl = user?.customAvatar || user?.avatar || null;
  const username = user?.login || user?.username || '';
  const nickname = user?.nickname || user?.displayName || '';

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <aside className="ss-root">
      <div className="ss-logo">
        <div className="ss-logo-icon">42</div>
        <span className="ss-logo-text">Hub</span>
      </div>
      <div className="ss-divider" />
      <nav className="ss-nav">
        <NavBtn icon={<DashboardIcon />} label="Home" href={`${MAIN_APP_URL}/`} />
        <NavBtn icon={<ChatIcon />} label="Chat" active />
        <NavBtn icon={<GameIcon />} label="Games" href="#" />
      </nav>
      <div className="ss-spacer" />
      <div className="ss-user" ref={menuRef}>
        <button className="ss-user-btn" onClick={() => setShowUserMenu(v => !v)}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="ss-user-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <div className="ss-user-fallback" style={{ display: avatarUrl ? 'none' : 'flex' }}>
            {(username || 'U').substring(0, 2).toUpperCase()}
          </div>
        </button>
        {showUserMenu && (
          <div className="ss-menu">
            <div className="ss-menu-head">
              <div className="ss-menu-name">{nickname || username}</div>
              {nickname && <div className="ss-menu-login">@{username}</div>}
            </div>
            <div className="ss-menu-sep" />
            <button className="ss-menu-item" onClick={() => { onSettingsClick(); setShowUserMenu(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              Settings
            </button>
            <a className="ss-menu-item" href={`${MAIN_APP_URL}/`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Back to Home
            </a>
          </div>
        )}
      </div>
      <style>{`
        .ss-root {
          width: 68px; background: var(--bg-deepest);
          display: flex; flex-direction: column; align-items: center;
          padding: 14px 0; flex-shrink: 0; border-right: 1px solid var(--border);
        }
        .ss-logo { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-bottom: 4px; }
        .ss-logo-icon {
          width: 42px; height: 42px; border-radius: 14px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; color: white;
        }
        .ss-logo-text { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .ss-divider { width: 28px; height: 2px; background: var(--border-strong); border-radius: 1px; margin: 10px 0; }
        .ss-nav { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .ss-spacer { flex: 1; }
        .ss-user { position: relative; }
        .ss-user-btn {
          width: 40px; height: 40px; border-radius: 50%;
          border: none; cursor: pointer; overflow: hidden;
          background: transparent; padding: 0; transition: transform 0.15s;
        }
        .ss-user-btn:hover { transform: scale(1.08); }
        .ss-user-img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .ss-user-fallback {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--accent); color: white;
          font-weight: 700; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
        }
        .ss-menu {
          position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
          width: 200px; background: var(--bg-elevated); border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; z-index: 50;
          animation: modalSlideUp 0.2s ease;
        }
        .ss-menu-head { padding: 14px 16px 10px; }
        .ss-menu-name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
        .ss-menu-login { font-size: 12px; color: var(--text-muted); }
        .ss-menu-sep { height: 1px; background: var(--border); margin: 0 12px; }
        .ss-menu-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 10px 16px; background: none; border: none;
          color: var(--text-secondary); font-size: 13px; font-family: inherit;
          cursor: pointer; text-decoration: none; transition: all var(--transition);
        }
        .ss-menu-item:hover { background: var(--bg-hover); color: var(--text-primary); }
      `}</style>
    </aside>
  );
}

function NavBtn({ icon, label, href, active }) {
  const [hovered, setHovered] = useState(false);
  const Comp = href ? 'a' : 'button';
  return (
    <Comp
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        width: 44, height: 44, borderRadius: active ? 14 : 22,
        background: active ? 'var(--accent)' : hovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer',
        color: active ? 'white' : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'all 0.2s', textDecoration: 'none',
      }}
    >{icon}</Comp>
  );
}

const DashboardIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>;
const ChatIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const GameIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="19" y1="12" x2="19" y2="12.01"/></svg>;