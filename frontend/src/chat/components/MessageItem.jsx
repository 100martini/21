import React, { useState, useEffect, useRef } from 'react';

const EMOJI_QUICK = ['👍', '❤️', '😂', '🔥'];

// Module-level singleton: only one message shows toolbar at a time
let _globalHideToolbar = null;

export default function MessageItem({
  message, isMine, previousMessage, nextMessage, onReactionAdd, onReactionRemove,
  onEdit, onDelete, currentUserId, isEditing, onEditSubmit, onEditCancel
}) {
  const [editValue, setEditValue] = useState(message.content || '');
  const [showActions, setShowActions] = useState(false);
  const editRef = useRef(null);
  const leaveTimer = useRef(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(message.content || '');
      setTimeout(() => {
        if (editRef.current) {
          editRef.current.focus();
          const len = editRef.current.value.length;
          editRef.current.setSelectionRange(len, len);
        }
      }, 0);
    }
  }, [isEditing]);

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    // hide any other message's toolbar immediately
    if (_globalHideToolbar && _globalHideToolbar !== setShowActions) _globalHideToolbar(false);
    _globalHideToolbar = setShowActions;
    setShowActions(true);
  };
  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setShowActions(false);
      if (_globalHideToolbar === setShowActions) _globalHideToolbar = null;
    }, 200);
  };
  const handleActionsEnter = () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSubmit(message.id, editValue, message.content); }
    if (e.key === 'Escape') onEditCancel();
  };
  const isSameSender = previousMessage && previousMessage.sender_id === message.sender_id;
  const isRecent = previousMessage && (new Date(message.created_at) - new Date(previousMessage.created_at) < 5 * 60 * 1000);
  const showMeta = !isSameSender || !isRecent;
  const isNextSameSender = nextMessage && nextMessage.sender_id === message.sender_id;
  const isNextRecent = nextMessage && (new Date(nextMessage.created_at) - new Date(message.created_at) < 5 * 60 * 1000);
  const showAvatar = !isNextSameSender || !isNextRecent;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const initials = message.sender_username
    ? message.sender_username.substring(0, 2).toUpperCase()
    : '?';

  const reactions = message.reactions || [];
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasReacted: false, emoji: r.emoji };
    acc[r.emoji].count++;
    if (r.user_id === currentUserId) acc[r.emoji].hasReacted = true;
    return acc;
  }, {});
  const reactionList = Object.values(groupedReactions);

  return (
    <div
      className={`mi-root ${isMine ? 'mine' : 'theirs'} ${showMeta ? 'show-meta' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mi-row">
        {/* Avatar */}
        <div className="mi-avatar-col">
          {showAvatar ? (
            <div className={`mi-avatar ${isMine ? 'mine' : ''}`}>
              {message.sender_avatar
                ? <img src={message.sender_avatar} alt={initials} className="mi-avatar-img" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentNode.dataset.fallback = 'true'; e.currentTarget.parentNode.textContent = initials; }} />
                : initials}
            </div>
          ) : (
            <div className="mi-avatar-spacer" />
          )}
        </div>

        {/* Bubble + meta */}
        <div className="mi-content">
          {showMeta && !isMine && (
            <div className="mi-header">
              <span className="mi-author">{message.sender_username || 'Unknown'}</span>
              <span className="mi-time">{formatTime(message.created_at)}</span>
            </div>
          )}

          {isEditing ? (
            <div className="mi-inline-edit">
              <textarea
                ref={editRef}
                className="mi-inline-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={Math.min(Math.max(editValue.split('\n').length, 1), 6)}
              />
              <div className="mi-inline-hints">
                <span>Enter to save · Esc to cancel</span>
                <div className="mi-inline-btns">
                  <button className="mi-inline-btn cancel" onClick={onEditCancel}>Cancel</button>
                  <button className="mi-inline-btn save" onClick={() => onEditSubmit(message.id, editValue, message.content)}>Save</button>
                </div>
              </div>
            </div>
          ) : (
          <div className={`mi-bubble ${isMine ? 'mine' : 'theirs'} ${message.deleted ? 'deleted' : ''} ${showMeta ? 'first' : ''}`}>
            {message.deleted
              ? <span className="mi-deleted-text">This message was deleted</span>
              : <>
                  {message.content && (
                    <span className="mi-text">
                      {message.content}
                      {message.edited && <span className="mi-edited"> (edited)</span>}
                    </span>
                  )}
                  {message.attachment_url && (
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
                </>
            }
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
        </div>
      </div>

      {/* Time + receipt — separate row so it doesn't affect mi-row height / avatar alignment */}
      {isMine && showAvatar && (
        <div className="mi-time-row">
          {showMeta && <span className="mi-time-right">{formatTime(message.created_at)}</span>}
          {message.read_at ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent)" opacity="0.9"><path d="M18 7l-1.41-1.41-6.34 6.34-2.83-2.83-1.41 1.41L10.25 15.17 18 7zM22 7l-1.41-1.41-6.34 6.34-2.83-2.83-1.41 1.41L14.25 15.17 22 7z"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--text-muted)" opacity="0.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          )}
        </div>
      )}

      {/* Hover action toolbar */}
      {!message.deleted && (
        <div
          className={`mi-actions ${isMine ? 'mine' : 'theirs'} ${showActions ? 'visible' : ''}`}
          onMouseEnter={handleActionsEnter}
          onMouseLeave={handleMouseLeave}
        >
          {EMOJI_QUICK.map(e => {
            const alreadyReacted = groupedReactions[e]?.hasReacted;
            return (
              <button
                key={e}
                className={`mi-action-btn emoji ${alreadyReacted ? 'reacted' : ''}`}
                onClick={() => alreadyReacted ? onReactionRemove(message.id, e) : onReactionAdd(message.id, e)}
                title={alreadyReacted ? 'Remove reaction' : 'React'}
              >{e}</button>
            );
          })}
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

      <style>{`
        /* ── root ── */
        .mi-root {
          padding: 2px 16px;
          padding-top: 38px;
          margin-top: -36px;
          position: relative;
        }
        .mi-root.show-meta { margin-top: -22px; }

        .mi-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }
        /* mirror row for mine */
        .mi-root.mine .mi-row { flex-direction: row-reverse; }

        /* ── avatar ── */
        .mi-avatar-col { flex-shrink: 0; align-self: flex-end; }
        .mi-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: var(--bg-elevated); color: var(--text-secondary);
          font-weight: 700; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .mi-avatar.mine { background: var(--accent); color: white; }
        .mi-avatar-spacer { width: 34px; flex-shrink: 0; }
        .mi-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }

        /* ── content column ── */
        .mi-content {
          display: flex;
          flex-direction: column;
          max-width: 68%;
          min-width: 0;
        }
        .mi-root.mine .mi-content { align-items: flex-end; }
        .mi-root.theirs .mi-content { align-items: flex-start; }

        .mi-header {
          display: flex; align-items: baseline; gap: 6px;
          margin-bottom: 3px; padding: 0 4px;
        }
        .mi-author { font-weight: 600; font-size: 12px; color: var(--text-secondary); }
        .mi-time { font-size: 10px; color: var(--text-muted); }

        /* ── bubble ── */
        .mi-bubble {
          padding: 9px 13px;
          border-radius: 18px;
          font-size: 14px; line-height: 1.5;
          word-break: break-word; white-space: pre-wrap;
          position: relative;
        }
        /* others: dark, pointy bottom-left */
        .mi-bubble.theirs {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border-radius: 4px 18px 18px 18px;
        }
        .mi-bubble.theirs:not(.first) {
          border-radius: 4px 18px 18px 18px;
        }
        /* mine: accent, pointy bottom-right */
        .mi-bubble.mine {
          background: var(--accent);
          color: white;
          border-radius: 18px 4px 18px 18px;
        }
        .mi-bubble.mine:not(.first) {
          border-radius: 18px 4px 18px 18px;
        }
        .mi-bubble.deleted {
          background: transparent !important;
          border: 1px dashed var(--border-strong);
        }
        .mi-deleted-text { font-style: italic; color: var(--text-muted); font-size: 13px; }

        .mi-text { display: block; }
        .mi-edited { font-size: 10px; opacity: 0.6; }

        /* link color inside mine bubble */
        .mi-bubble.mine a { color: rgba(255,255,255,0.85); }
        .mi-bubble.mine .mi-attachment-link { color: rgba(255,255,255,0.85); }

        /* ── attachment ── */
        .mi-attachment { margin-top: 6px; }
        .mi-attachment-img {
          max-width: min(320px, 100%); max-height: 240px;
          border-radius: var(--radius-md);
          display: block;
        }
        .mi-attachment-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: var(--accent); text-decoration: none;
        }
        .mi-attachment-link:hover { text-decoration: underline; }

        /* ── time + receipt (mine) — sits below mi-row, doesn't affect avatar alignment ── */
        .mi-time-row {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 4px;
          padding-right: 42px; /* avatar(34) + gap(8) — aligns under the bubble */
          margin-top: 2px;
        }
        .mi-time-right { font-size: 10px; color: var(--text-muted); }

        /* ── reactions ── */
        .mi-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; position: relative; z-index: 2; }
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

        /* ── hover actions ── */
        .mi-actions {
          position: absolute;
          top: 4px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-md);
          padding: 3px;
          display: flex; align-items: center; gap: 1px;
          box-shadow: var(--shadow-md);
          z-index: 50;
          opacity: 0;
          pointer-events: none;
          transform: translateY(3px);
          transition: opacity 0.18s ease, transform 0.18s ease;
        }
        .mi-actions.mine { right: 56px; }
        .mi-actions.theirs { left: 56px; }
        .mi-actions.visible {
          opacity: 1; pointer-events: auto; transform: translateY(0);
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
        .mi-action-btn.emoji.reacted { color: var(--accent); opacity: 1; }
        .mi-action-btn.danger:hover { background: var(--danger-soft); color: var(--danger); }
        .mi-action-divider { width: 1px; height: 16px; background: var(--border); margin: 0 2px; }

        /* ── inline edit ── */
        .mi-inline-edit {
          display: flex; flex-direction: column; gap: 6px;
          width: 100%;
        }
        .mi-inline-textarea {
          width: 100%; resize: none;
          background: var(--bg-deep);
          border: 1.5px solid var(--accent);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px; font-family: inherit; line-height: 1.5;
          padding: 8px 12px;
          box-shadow: 0 0 0 3px rgba(124,106,239,0.15);
        }
        .mi-inline-textarea:focus { outline: none; }
        .mi-inline-hints {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 11px; color: var(--text-muted);
        }
        .mi-inline-btns { display: flex; gap: 6px; }
        .mi-inline-btn {
          padding: 4px 12px; border-radius: var(--radius-sm);
          font-size: 12px; font-weight: 600; cursor: pointer;
          border: none; font-family: inherit; transition: all 0.1s;
        }
        .mi-inline-btn.cancel {
          background: var(--bg-hover); color: var(--text-secondary);
        }
        .mi-inline-btn.cancel:hover { background: var(--bg-active); color: var(--text-primary); }
        .mi-inline-btn.save {
          background: var(--accent); color: white;
        }
        .mi-inline-btn.save:hover { background: var(--accent-hover); }

        @media (max-width: 767px) {
          .mi-root { padding: 38px 10px 2px; }
          .mi-content { max-width: 80%; }
          .mi-bubble { font-size: 13px; padding: 8px 12px; }
          .mi-avatar { width: 30px; height: 30px; font-size: 11px; }
          .mi-avatar-spacer { width: 30px; }
        }
      `}</style>
    </div>
  );
}
