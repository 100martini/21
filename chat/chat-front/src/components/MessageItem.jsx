import React from 'react';

const EMOJI_QUICK = ['👍', '❤️', '😂', '🔥'];

export default function MessageItem({
  message, isMine, previousMessage, onReactionAdd, onReactionRemove,
  onEdit, onDelete, currentUserId
}) {
  const isSameSender = previousMessage && previousMessage.sender_id === message.sender_id;
  const isRecent = previousMessage && (new Date(message.created_at) - new Date(previousMessage.created_at) < 5 * 60 * 1000);
  const showAvatar = !isSameSender || !isRecent;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const reactions = message.reactions || [];
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasReacted: false, emoji: r.emoji };
    acc[r.emoji].count++;
    if (r.user_id === currentUserId) acc[r.emoji].hasReacted = true;
    return acc;
  }, {});
  const reactionList = Object.values(groupedReactions);

  return (
    <div className={`mi-root ${showAvatar ? 'show-avatar' : ''}`}>
      <div className="mi-row">
        {/* Avatar */}
        <div className="mi-avatar-col">
          {showAvatar ? (
            <div className={`mi-avatar ${isMine ? 'mine' : ''}`}>
              {message.sender_username ? message.sender_username.substring(0, 2).toUpperCase() : '?'}
            </div>
          ) : (
            <div className="mi-time-inline">
              <span className="mi-hover-time">{formatTime(message.created_at)}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mi-content">
          {showAvatar && (
            <div className="mi-header">
              <span className="mi-author">{isMine ? 'You' : (message.sender_username || 'Unknown')}</span>
              <span className="mi-time">{formatTime(message.created_at)}</span>
            </div>
          )}
          <div className={`mi-text ${message.deleted ? 'deleted' : ''}`}>
            {message.deleted ? 'This message was deleted' : message.content}
            {message.edited && !message.deleted && <span className="mi-edited">(edited)</span>}
          </div>

          {message.attachment_url && !message.deleted && (
            <div className="mi-attachment">
              {/\.(png|jpe?g|gif|webp)$/i.test(message.attachment_url) ? (
                <img src={message.attachment_url} alt="attachment" className="mi-attachment-img" />
              ) : (
                <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mi-attachment-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  Download file
                </a>
              )}
            </div>
          )}

          {reactionList.length > 0 && (
            <div className="mi-reactions">
              {reactionList.map(r => (
                <button
                  key={r.emoji}
                  className={`mi-reaction ${r.hasReacted ? 'reacted' : ''}`}
                  onClick={() => r.hasReacted ? onReactionRemove(message.id, r.emoji) : onReactionAdd(message.id, r.emoji)}
                >
                  <span>{r.emoji}</span>
                  <span className="mi-reaction-count">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {isMine && (
            <div className="mi-receipt">
              {message.read_at ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" opacity="0.8"><path d="M18 7l-1.41-1.41-6.34 6.34-2.83-2.83-1.41 1.41L10.25 15.17 18 7zM22 7l-1.41-1.41-6.34 6.34-2.83-2.83-1.41 1.41L14.25 15.17 22 7z"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-muted)" opacity="0.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              )}
            </div>
          )}
        </div>

        {/* CSS-only hover actions - no React state needed */}
        {!message.deleted && (
          <div className="mi-actions">
            {EMOJI_QUICK.map(e => (
              <button key={e} className="mi-action-btn emoji" onClick={() => onReactionAdd(message.id, e)}>{e}</button>
            ))}
            {isMine && (
              <>
                <div className="mi-action-divider" />
                <button className="mi-action-btn" onClick={() => onEdit(message)} title="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button className="mi-action-btn danger" onClick={() => onDelete(message)} title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .mi-root {
          padding: 2px 16px;
          position: relative;
          transition: background 0.1s ease;
        }
        .mi-root:hover { background: var(--bg-hover); }
        .mi-root.show-avatar { margin-top: 12px; }
        .mi-row {
          display: flex;
          gap: 12px;
          position: relative;
        }
        .mi-avatar-col {
          width: 36px;
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
          padding-top: 2px;
        }
        .mi-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--bg-elevated); color: var(--text-secondary);
          font-weight: 700; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .mi-avatar.mine {
          background: var(--accent); color: white;
        }
        .mi-time-inline {
          width: 36px;
          display: flex; align-items: center; justify-content: center;
        }
        .mi-hover-time {
          font-size: 10px; color: var(--text-muted);
          opacity: 0; transition: opacity 0.1s;
        }
        .mi-root:hover .mi-hover-time { opacity: 1; }
        .mi-content { flex: 1; min-width: 0; padding: 2px 0; }
        .mi-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
        .mi-author { font-weight: 600; font-size: 14px; color: var(--text-primary); }
        .mi-time { font-size: 11px; color: var(--text-muted); }
        .mi-text {
          font-size: 14px; line-height: 1.5;
          color: var(--text-primary);
          word-break: break-word; white-space: pre-wrap;
        }
        .mi-text.deleted { font-style: italic; color: var(--text-muted); }
        .mi-edited { font-size: 10px; color: var(--text-muted); margin-left: 4px; }
        .mi-attachment { margin-top: 6px; }
        .mi-attachment-img {
          max-width: min(400px, 100%); max-height: 280px;
          border-radius: var(--radius-md); border: 1px solid var(--border);
        }
        .mi-attachment-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: var(--accent); text-decoration: none;
        }
        .mi-attachment-link:hover { text-decoration: underline; }
        .mi-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .mi-reaction {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 12px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          color: var(--text-primary); font-size: 12px;
          cursor: pointer; transition: all var(--transition); font-family: inherit;
        }
        .mi-reaction.reacted { background: var(--accent-soft); border-color: var(--accent); }
        .mi-reaction:hover { border-color: var(--text-muted); }
        .mi-reaction-count { font-weight: 600; font-size: 11px; }
        .mi-receipt { display: flex; justify-content: flex-end; margin-top: 2px; }

        /* KEY FIX: CSS-only visibility, not React state.
           Hover on .mi-root (parent) keeps .mi-actions visible
           even when cursor moves to the absolutely-positioned toolbar. */
        .mi-actions {
          position: absolute;
          top: -16px; right: 0;
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-md);
          padding: 3px;
          display: flex; align-items: center; gap: 1px;
          box-shadow: var(--shadow-md);
          z-index: 5;
          /* Hidden by default */
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
          transition: opacity 0.12s ease, transform 0.12s ease;
        }
        .mi-root:hover .mi-actions {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .mi-action-btn {
          width: 28px; height: 28px;
          border: none; background: transparent;
          color: var(--text-muted); cursor: pointer;
          border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; transition: all 0.1s;
        }
        .mi-action-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .mi-action-btn.emoji:hover { transform: scale(1.15); }
        .mi-action-btn.danger:hover { background: var(--danger-soft); color: var(--danger); }
        .mi-action-divider { width: 1px; height: 16px; background: var(--border); margin: 0 2px; }

        @media (max-width: 767px) {
          .mi-root { padding: 2px 12px; }
          .mi-avatar-col { width: 32px; }
          .mi-avatar { width: 32px; height: 32px; font-size: 11px; }
        }
      `}</style>
    </div>
  );
}