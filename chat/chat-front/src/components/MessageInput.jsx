import React, { useState, useRef } from 'react';

export default function MessageInput({ onSendMessage, onTyping, channelName }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
  const handleSend = () => {
    if (text.trim() || file) { onSendMessage(text, file); setText(""); setFile(null); }
  };
  const handleChange = (e) => { setText(e.target.value); onTyping && onTyping(); };
  const handlePickFile = () => { if (fileInputRef.current) fileInputRef.current.click(); };
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 1 * 1024 * 1024) { alert("File too large (max 1MB)."); e.target.value = ""; return; }
    setFile(selected);
  };
  const removeFile = () => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  return (
    <div className="mi-wrap">
      {file && (
        <div className="mi-file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          <span className="mi-fname">{file.name}</span>
          <span className="mi-fsize">{Math.round(file.size / 1024)} KB</span>
          <button className="mi-fremove" onClick={removeFile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}
      <div className="mi-bar">
        <button className="mi-attach" onClick={handlePickFile} title="Attach file">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" /></svg>
        </button>
        <input type="text" value={text} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName || 'channel'}`} className="mi-input" />
        <button className={`mi-send ${(text.trim() || file) ? 'active' : ''}`} onClick={handleSend}
          disabled={!text.trim() && !file} title="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
      <style>{`
        .mi-wrap { padding: 0 16px 16px; flex-shrink: 0; }
        .mi-file {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; margin-bottom: 8px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-md); color: var(--text-secondary);
        }
        .mi-fname { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .mi-fsize { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
        .mi-fremove {
          width: 24px; height: 24px; border-radius: 4px;
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .mi-fremove:hover { background: var(--danger-soft); color: var(--danger); }
        .mi-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; background: var(--bg-elevated);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          transition: border-color 0.15s;
        }
        .mi-bar:focus-within { border-color: rgba(124,106,239,0.4); }
        .mi-attach {
          width: 32px; height: 32px; border-radius: 50%;
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .mi-attach:hover { color: var(--text-primary); }
        .mi-input {
          flex: 1; background: transparent; border: none;
          color: var(--text-primary); font-size: 14px; font-family: inherit; min-width: 0;
        }
        .mi-input::placeholder { color: var(--text-muted); }
        .mi-send {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--bg-hover); border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: all 0.15s;
        }
        .mi-send.active { background: var(--accent); color: white; }
        .mi-send.active:hover { background: var(--accent-hover); }
        .mi-send:disabled { opacity: 0.4; cursor: not-allowed; }
        @media (max-width: 767px) {
          .mi-wrap { padding: 0 12px 12px; }
          .mi-input { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}