import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';

export default function MessageList({
  messages = [], currentUserId, onReactionAdd, onReactionRemove,
  onEdit, onDelete, typingUsers = new Set(), membersById = {}, loading = false,
  editingId, onEditSubmit, onEditCancel
}) {
  const scrollRef = useRef(null);
  const otherTypingIds = typingUsers
    ? [...typingUsers].filter(id => id !== currentUserId)
    : [];
  const otherTypingUsers = new Set(otherTypingIds);

  const typingLabel = (() => {
    if (otherTypingIds.length === 0) return null;
    const names = otherTypingIds.map(id => {
      const name = membersById[id];
      return name ? `@${name}` : 'Someone';
    });
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  })();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length, otherTypingUsers.size]);

  return (
    <div className="ml-root" ref={scrollRef}>
      <div className="ml-inner">
        {loading && (
          <div className="ml-loading">
            <div className="ml-spinner" />
            <span>Loading messages...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="ml-empty">
            <p>No messages yet. Say something!</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <MessageItem
            key={m.id || `m_${idx}`}
            message={m}
            previousMessage={idx > 0 ? messages[idx - 1] : null}
            nextMessage={idx < messages.length - 1 ? messages[idx + 1] : null}
            isMine={m.sender_id === currentUserId}
            currentUserId={currentUserId}
            onReactionAdd={onReactionAdd}
            onReactionRemove={onReactionRemove}
            onEdit={onEdit}
            onDelete={onDelete}
            isEditing={editingId === m.id}
            onEditSubmit={onEditSubmit}
            onEditCancel={onEditCancel}
          />
        ))}

        {typingLabel && (
          <div className="ml-typing">
            <div className="ml-typing-dots">
              <span /><span /><span />
            </div>
            <span className="ml-typing-text">{typingLabel}</span>
          </div>
        )}
      </div>

      <style>{`
        .ml-root { flex: 1; overflow-y: auto; overflow-x: hidden; }
        .ml-inner {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 16px 0 8px;
        }
        .ml-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }
        .ml-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; padding: 20px; color: var(--text-muted); font-size: 13px;
        }
        .ml-spinner {
          width: 16px; height: 16px;
          border: 2px solid var(--border-strong);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ml-typing {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 20px; margin-left: 48px;
        }
        .ml-typing-dots { display: flex; gap: 3px; align-items: center; }
        .ml-typing-dots span {
          width: 5px; height: 5px;
          background: var(--text-muted); border-radius: 50%;
          animation: pulse-dot 1.4s infinite;
        }
        .ml-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .ml-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        .ml-typing-text { font-size: 12px; color: var(--text-muted); font-style: italic; }
      `}</style>
    </div>
  );
}