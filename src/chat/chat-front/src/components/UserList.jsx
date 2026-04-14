import React, { useState } from 'react';

export default function UserList({
  members, onlineUserIds, currentUserId, onBlockUser, onUnblockUser,
  blockedUsers = new Set(), isOverlay = false, onClose
}) {
  const [confirmAction, setConfirmAction] = useState(null);
  const onlineMembers = members.filter(m => onlineUserIds.has(m.id));
  const offlineMembers = members.filter(m => !onlineUserIds.has(m.id));

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'block') await onBlockUser(confirmAction.user.id);
    else await onUnblockUser(confirmAction.user.id);
    setConfirmAction(null);
  };

  return (
    <div className="ul-root">
      <div className="ul-head">
        <span className="ul-head-t">Members</span>
        {isOverlay && (
          <button className="ul-x" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
      <div className="ul-scroll">
        {onlineMembers.length > 0 && <Group title={`Online — ${onlineMembers.length}`} users={onlineMembers} online currentUserId={currentUserId} blockedUsers={blockedUsers} onAction={setConfirmAction} />}
        {offlineMembers.length > 0 && <Group title={`Offline — ${offlineMembers.length}`} users={offlineMembers} currentUserId={currentUserId} blockedUsers={blockedUsers} onAction={setConfirmAction} />}
      </div>

      {confirmAction && (
        <div className="ul-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="ul-modal" onClick={e => e.stopPropagation()}>
            <div className="ul-modal-ico">
              {confirmAction.type === 'block' ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              )}
            </div>
            <h4 className="ul-modal-title">{confirmAction.type === 'block' ? 'Block User' : 'Unblock User'}</h4>
            <p className="ul-modal-desc">
              {confirmAction.type === 'block'
                ? `Block ${confirmAction.user.username}? They won't be able to message you.`
                : `Unblock ${confirmAction.user.username}? They'll be able to message you again.`}
            </p>
            <div className="ul-modal-btns">
              <button className="ul-mbtn cancel" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={`ul-mbtn ${confirmAction.type === 'block' ? 'danger' : 'confirm'}`} onClick={handleConfirm}>
                {confirmAction.type === 'block' ? 'Block' : 'Unblock'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ul-root {
          width: 240px; background: var(--bg-surface);
          display: flex; flex-direction: column; height: 100%;
          border-left: 1px solid var(--border);
        }
        @media (max-width: 767px) { .ul-root { width: 260px; } }
        .ul-head {
          height: 52px; min-height: 52px; padding: 0 16px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .ul-head-t { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .ul-x {
          width: 28px; height: 28px; border-radius: var(--radius-sm);
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .ul-x:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ul-scroll { flex: 1; overflow-y: auto; padding: 12px 8px; }
        .ul-grp { margin-bottom: 16px; }
        .ul-grp-t { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); padding: 0 8px 6px; }
        .ul-mem { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: var(--radius-sm); position: relative; }
        .ul-mem:hover { background: var(--bg-hover); }
        .ul-aw { position: relative; width: 30px; height: 30px; flex-shrink: 0; }
        .ul-av {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 11px; color: white;
        }
        .ul-av.on { background: var(--accent); }
        .ul-av.off { background: var(--bg-elevated); color: var(--text-muted); }
        .ul-dot {
          position: absolute; bottom: -1px; right: -1px;
          width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--bg-surface);
        }
        .ul-dot.on { background: var(--success); }
        .ul-dot.off { background: var(--text-muted); }
        .ul-mi { flex: 1; min-width: 0; }
        .ul-mn {
          font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: flex; align-items: center; gap: 6px;
        }
        .ul-blocked { font-size: 9px; padding: 1px 6px; border-radius: 8px; background: var(--danger-soft); color: var(--danger); font-weight: 600; }
        .ul-act { opacity: 0; transition: opacity 0.1s; }
        .ul-mem:hover .ul-act { opacity: 1; }
        .ul-abtn {
          padding: 4px 10px; border-radius: var(--radius-sm);
          border: none; font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.1s; font-family: inherit;
        }
        .ul-abtn.block { background: var(--danger-soft); color: var(--danger); }
        .ul-abtn.block:hover { background: var(--danger); color: white; }
        .ul-abtn.unblock { background: var(--success-soft); color: var(--success); }
        .ul-abtn.unblock:hover { background: var(--success); color: white; }
        .ul-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 16px; animation: fadeIn 0.15s ease;
        }
        .ul-modal {
          background: var(--bg-elevated); border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl); padding: 28px; max-width: 360px; width: 100%;
          text-align: center; box-shadow: var(--shadow-lg);
          animation: modalSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ul-modal-ico { margin-bottom: 16px; }
        .ul-modal-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
        .ul-modal-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px; }
        .ul-modal-btns { display: flex; gap: 10px; justify-content: center; }
        .ul-mbtn {
          padding: 10px 24px; border-radius: var(--radius-md); border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 0.15s; font-family: inherit; min-width: 100px;
        }
        .ul-mbtn.cancel { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-strong); }
        .ul-mbtn.cancel:hover { background: var(--bg-active); }
        .ul-mbtn.danger { background: var(--danger); color: white; }
        .ul-mbtn.danger:hover { opacity: 0.9; }
        .ul-mbtn.confirm { background: var(--success); color: white; }
        .ul-mbtn.confirm:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}

function Group({ title, users, online, currentUserId, blockedUsers, onAction }) {
  return (
    <div className="ul-grp">
      <div className="ul-grp-t">{title}</div>
      {users.map(u => {
        const isBlocked = blockedUsers.has(u.id);
        const isMe = u.id === currentUserId;
        return (
          <div key={u.id} className="ul-mem">
            <div className="ul-aw">
              <div className={`ul-av ${online ? 'on' : 'off'}`}>{(u.username || 'U').substring(0, 2).toUpperCase()}</div>
              <div className={`ul-dot ${online ? 'on' : 'off'}`} />
            </div>
            <div className="ul-mi">
              <div className="ul-mn">
                {u.username}
                {isMe && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(you)</span>}
                {isBlocked && <span className="ul-blocked">Blocked</span>}
              </div>
            </div>
            {!isMe && (
              <div className="ul-act">
                {isBlocked
                  ? <button className="ul-abtn unblock" onClick={() => onAction({ type: 'unblock', user: u })}>Unblock</button>
                  : <button className="ul-abtn block" onClick={() => onAction({ type: 'block', user: u })}>Block</button>
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}