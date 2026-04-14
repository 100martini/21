// MessageList.jsx (remplacer entièrement)
import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';

export default function MessageList({
    messages = [],
    currentUserId,
    onReactionAdd,
    onReactionRemove,
    onEdit,
    onDelete,
    typingUsers = new Set()
}) {
    const containerRef = useRef(null);

    const otherTypingUsers = typingUsers
        ? new Set([...typingUsers].filter(id => id !== currentUserId))
        : new Set();

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
        const shouldAutoScroll = distanceFromBottom < 120;
        if (shouldAutoScroll) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages.length, otherTypingUsers.size]);

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto relative p-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#5C5470 #1a1721' }}
        >
            {/* msg */}
            <div className="mt-4 mb-8 pb-4" style={{ borderBottom: '1px solid rgba(185,180,199,0.08)' }}>
                <div className="w-[68px] h-[68px] rounded-full flex items-center justify-center mb-4" style={{ background: '#352F44' }}>
                    <span className="text-3xl font-bold" style={{ color: '#B9B4C7' }}>#</span>
                </div>
                <h1 className="text-3xl font-bold mb-2" style={{ color: '#FAF0E6' }}>Bienvenue dans le chat !</h1>
                <p style={{ color: '#B9B4C7' }}>C'est le début de votre conversation.</p>
            </div>

            {/* msg */}
            <div className="flex flex-col gap-1">
                {messages.map((m, idx) => {
                    const previousMessage = idx > 0 ? messages[idx - 1] : null;
                    return (
                        <MessageItem
                            key={m.id ?? `m_${idx}`}
                            message={m}
                            previousMessage={previousMessage}
                            isMine={m.sender_id === currentUserId}
                            currentUserId={currentUserId}
                            onReactionAdd={onReactionAdd}
                            onReactionRemove={onReactionRemove}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    );
                })}
            </div>

            {/* Typing */}
            {otherTypingUsers.size > 0 && (
                <div className="mt-2 text-xs italic flex items-center gap-1 h-6" style={{ color: '#B9B4C7' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B9B4C7', animationDelay: '0ms' }}></span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B9B4C7', animationDelay: '150ms' }}></span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B9B4C7', animationDelay: '300ms' }}></span>
                    <span className="ml-1">{otherTypingUsers.size === 1 ? "est en train d'écrire…" : "Plusieurs personnes écrivent…"}</span>
                </div>
            )}
        </div>
    );
}