import React from 'react';

export default function ChannelList({
  user, conversations, selectedConv, onSelectConv, onCreateDM,
  friends = [], onStartDM, onlineUserIds = new Set(),
  isMobile = false, onClose
}) {
  const safeFriends = Array.isArray(friends) ? friends : [];
  const channels = conversations.filter(c => c.is_group);
  const dms = conversations.filter(c => !c.is_group);

  return (
    <div className="cl-root">
      <div className="cl-header">
        <h1 className="cl-title">ft_transcendence</h1>
        {isMobile && (
          <button className="cl-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
      <div className="cl-scroll">
        <Section title="Channels">
          {channels.map(c => (
            <button key={c.id} className={`cl-btn ${selectedConv?.id === c.id ? 'active' : ''}`} onClick={() => onSelectConv(c)}>
              <span className="cl-hash">#</span>
              <span className="cl-label">{c.name || `channel-${c.id}`}</span>
            </button>
          ))}
          {channels.length === 0 && <div className="cl-empty">No channels yet</div>}
        </Section>
        <Section title="Direct Messages" action={<button className="cl-add" onClick={onCreateDM}>+</button>}>
          {safeFriends.map(friend => {
            const existingConv = conversations.find(c => !c.is_group && (c.name === (friend.login || friend.username) || c.name === friend.nickname));
            const isOnline = onlineUserIds.has(friend.id || friend.intraId);
            const avatarUrl = friend.effectiveAvatar || friend.customAvatar || friend.avatar;
            const initials = (friend.login || friend.username || 'U').substring(0, 2).toUpperCase();
            const name = friend.nickname || friend.displayName || friend.login || friend.username || 'Friend';
            return (
              <button
                key={`f-${friend.id || friend.intraId}`}
                className={`cl-dm ${selectedConv?.id === existingConv?.id ? 'active' : ''}`}
                onClick={() => existingConv ? onSelectConv(existingConv) : onStartDM && onStartDM(friend)}
              >
                <div className="cl-dm-aw">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="cl-dm-img" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                  <div className="cl-dm-ini" style={{ display: avatarUrl ? 'none' : 'flex' }}>{initials}</div>
                  {isOnline && <div className="cl-online" />}
                </div>
                <span className="cl-dm-name">{name}</span>
              </button>
            );
          })}
          {dms.filter(c => !safeFriends.some(f => c.name === (f.login || f.username) || c.name === f.nickname)).map(c => (
            <button key={`dm-${c.id}`} className={`cl-btn ${selectedConv?.id === c.id ? 'active' : ''}`} onClick={() => onSelectConv(c)}>
              <div className="cl-dm-ini small">{c.name ? c.name[0].toUpperCase() : 'U'}</div>
              <span className="cl-label">{c.name || `dm-${c.id}`}</span>
            </button>
          ))}
        </Section>
      </div>
      {user && (
        <div className="cl-user">
          <div className="cl-user-av">{(user.login || user.username || 'U').substring(0, 2).toUpperCase()}</div>
          <div className="cl-user-info">
            <div className="cl-user-name">{user.nickname || user.login || user.username}</div>
            <div className="cl-user-stat">Online</div>
          </div>
        </div>
      )}
      <style>{`
        .cl-root {
          width: 260px; background: var(--bg-surface);
          display: flex; flex-direction: column; height: 100%;
          border-right: 1px solid var(--border);
        }
        @media (max-width: 767px) { .cl-root { width: 280px; } }
        .cl-header {
          height: 52px; min-height: 52px; padding: 0 16px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .cl-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .cl-close {
          width: 32px; height: 32px; border-radius: var(--radius-sm);
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .cl-close:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cl-scroll { flex: 1; overflow-y: auto; padding: 8px; }
        .cl-sec { margin-bottom: 16px; }
        .cl-sec-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 4px; }
        .cl-sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); }
        .cl-add {
          width: 20px; height: 20px; border-radius: 4px;
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; font-size: 16px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
        }
        .cl-add:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cl-btn {
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 7px 10px; border-radius: var(--radius-sm);
          background: transparent; border: none; color: var(--text-secondary);
          cursor: pointer; transition: background 0.1s; font-family: inherit; font-size: 14px; text-align: left;
        }
        .cl-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cl-btn.active { background: var(--bg-active); color: var(--text-primary); }
        .cl-hash { color: var(--text-muted); font-size: 17px; font-weight: 300; flex-shrink: 0; width: 20px; text-align: center; }
        .cl-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
        .cl-dm {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 6px 10px; border-radius: var(--radius-sm);
          background: transparent; border: none; color: var(--text-secondary);
          cursor: pointer; transition: background 0.1s; font-family: inherit; text-align: left;
        }
        .cl-dm:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cl-dm.active { background: var(--bg-active); color: var(--text-primary); }
        .cl-dm-aw { position: relative; width: 32px; height: 32px; flex-shrink: 0; }
        .cl-dm-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
        .cl-dm-ini {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--bg-elevated); color: var(--text-secondary);
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .cl-dm-ini.small { width: 28px; height: 28px; font-size: 10px; }
        .cl-online {
          position: absolute; bottom: 0; right: 0;
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--success); border: 2px solid var(--bg-surface);
        }
        .cl-dm-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }
        .cl-empty { padding: 12px 10px; font-size: 13px; color: var(--text-muted); }
        .cl-user {
          padding: 12px 16px; border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px;
        }
        .cl-user-av {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--accent); color: white;
          font-weight: 700; font-size: 11px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .cl-user-info { min-width: 0; }
        .cl-user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cl-user-stat { font-size: 11px; color: var(--success); }
      `}</style>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="cl-sec">
      <div className="cl-sec-head">
        <span className="cl-sec-title">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}