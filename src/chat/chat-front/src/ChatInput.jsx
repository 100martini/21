// MessageInput.jsx 
import React, { useState, useRef } from 'react';

export default function MessageInput({ onSendMessage, onTyping, channelName }) {
    const [text, setText] = useState("");
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim() || file) {
                onSendMessage(text, file);
                setText("");
                setFile(null);
            }
        }
    };

    const handleChange = (e) => {
        setText(e.target.value);
        onTyping && onTyping();
    };

    const handlePickFile = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        const maxSize = 1 * 1024 * 1024;
        if (selected.size > maxSize) {
            alert("Fichier trop grand (max 1MB).");
            e.target.value = "";
            return;
        }
        setFile(selected);
    };

    return (
        <div className="px-4 pb-6 flex-none"> {/* flex */}
            <div
                className="rounded-[10px] flex items-center px-4 py-2.5"
                style={{ background: '#352F44', border: '1px solid rgba(185,180,199,0.1)' }}
            >
                <button
                    type="button"
                    onClick={handlePickFile}
                    className="mr-3 transition-colors"
                    style={{ color: '#B9B4C7' }}
                    onMouseOver={e => e.currentTarget.style.color = '#FAF0E6'}
                    onMouseOut={e => e.currentTarget.style.color = '#B9B4C7'}
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" /></svg>
                </button>
                <input
                    type="text"
                    value={text}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message #${channelName || 'channel'}`}
                    className="bg-transparent flex-1 outline-none font-medium"
                    style={{ color: '#FAF0E6' }}
                />
                {file && (
                    <span className="ml-2 text-xs truncate max-w-[160px]" style={{ color: '#B9B4C7' }}>
                        {file.name} ({Math.round(file.size / 1024)} Ko)
                    </span>
                )}
                <div className="flex items-center space-x-3 ml-3">
                    <button
                        className="transition-colors"
                        style={{ color: '#B9B4C7' }}
                        onMouseOver={e => e.currentTarget.style.color = '#FAF0E6'}
                        onMouseOut={e => e.currentTarget.style.color = '#B9B4C7'}
                    >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm8-5c0-.55-.45-1-1-1s-1 .45-1 1 .45 1 1 1 1-.45 1-1zm6 0c0-.55-.45-1-1-1s-1 .45-1 1 .45 1 1 1 1-.45 1-1zm-4 4c-1.84 0-3.48.96-4.34 2.5-.18.33.02.75.4.75h7.89c.38 0 .57-.42.4-.75-.87-1.54-2.5-2.5-4.35-2.5z" /></svg>
                    </button>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            </div>
        </div>
    );
}