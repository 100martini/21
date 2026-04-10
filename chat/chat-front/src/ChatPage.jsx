import React, { useEffect, useState, useRef } from "react";
import ServerSidebar from './components/ServerSidebar';
import ChannelList from './components/ChannelList';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import UserList from './components/UserList';

const MAIN_API = import.meta.env.VITE_MAIN_API_URL || 'https://localhost:8443/api';
const getMainAppUser = () => { try { const raw = sessionStorage.getItem('user'); return raw ? JSON.parse(raw) : null; } catch { return null; } };

export default function ChatPage({ apiBaseUrl = "https://localhost:8000" }) {
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showChannelSidebar, setShowChannelSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);
  const [token, setToken] = useState(() => localStorage.getItem("token") || localStorage.getItem("chat_token") || "");
  const [me, setMe] = useState(() => getMainAppUser());
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const typingTimeoutRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const h = () => { const w = window.innerWidth; setIsMobile(w < 768); setIsTablet(w < 1024); if (w >= 768) setShowChannelSidebar(false); if (w >= 1024) setShowMembersPanel(prev => prev); };
    window.addEventListener('resize', h); h();
    return () => window.removeEventListener('resize', h);
  }, []);

  const authHeaders = (extra = {}, options = { json: true }) => {
    const h = { ...(options.json ? { "Content-Type": "application/json" } : {}), ...extra };
    if (token?.trim()) h.Authorization = `Bearer ${token.trim()}`;
    return h;
  };
  const saveToken = (t) => { const s = t?.trim() || ""; setToken(s); if (s) localStorage.setItem("chat_token", s); else localStorage.removeItem("chat_token"); };
  const postJSON = async (url, body, method = "POST") => {
    try { const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) }); if (!res.ok) return null; return await res.json(); } catch { return null; }
  };

  const loadMe = async () => {
    if (!token) { setMe(null); return; }
    let profileData = getMainAppUser();
    try { const res = await fetch(`${MAIN_API}/profile`, { headers: { Authorization: `Bearer ${token.trim()}` } }); if (res.ok) profileData = await res.json(); } catch { }
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/me`, { headers: authHeaders() });
      if (res.ok) { const cu = await res.json(); setMe({ ...(profileData || {}), id: cu.id, username: cu.username || profileData?.login || profileData?.username || '' }); setOnlineUserIds(p => new Set(p).add(cu.id)); }
      else if (profileData) setMe(profileData); else setMe(null);
    } catch { if (profileData) setMe(profileData); else setMe(null); }
  };
  const loadConversations = async () => { if (!token) return; const res = await fetch(`${apiBaseUrl}/api/chat/conversations`, { headers: authHeaders() }); if (res.ok) setConversations(await res.json()); };
  const syncTeams = async () => { if (!token) return; try { const res = await fetch(`${apiBaseUrl}/api/chat/conversations/sync_teams`, { method: "POST", headers: authHeaders() }); if (res.ok) await loadConversations(); } catch { } };
  const loadBlockedUsers = async () => { if (!token) return; try { const res = await fetch(`${apiBaseUrl}/api/users/blocked`, { headers: authHeaders() }); if (res.ok) { const users = await res.json(); setBlockedUsers(new Set(users.map(u => u.id))); } } catch { } };
  const loadFriends = async () => {
    if (!token) return;
    try { const res = await fetch(`${apiBaseUrl}/api/chat/friends`, { headers: authHeaders() }); if (res.ok) { const data = await res.json(); setFriends(data.map(f => ({ id: f.friend_id, login: f.friend_login, nickname: f.friend_nickname, effectiveAvatar: f.friend_avatar, displayName: f.friend_display_name }))); return; } } catch { }
    try { const res = await fetch(`${MAIN_API}/friends`, { headers: { Authorization: `Bearer ${token.trim()}` } }); if (res.ok) setFriends(await res.json()); } catch { }
  };
  const handleSearchUsers = async (q) => { setSearchQuery(q); if (!q || q.length < 2) { setSearchResults([]); return; } try { const res = await fetch(`${apiBaseUrl}/api/chat/search_users?query=${encodeURIComponent(q)}`, { headers: authHeaders() }); if (res.ok) setSearchResults(await res.json()); } catch { } };
  const startDirectMessage = async (targetUser) => {
    setShowSearchModal(false); setSearchQuery(""); setSearchResults([]);
    const loginOrUsername = targetUser.login || targetUser.username;
    const existingDm = conversations.find(c => !c.is_group && c.name?.includes(loginOrUsername));
    if (existingDm) { openConversation(existingDm); return; }
    try { const res = await postJSON(`${apiBaseUrl}/api/chat/conversations/direct`, { friend_id: targetUser.id }); if (res?.conversation_id) { await loadConversations(); const r2 = await fetch(`${apiBaseUrl}/api/chat/conversations`, { headers: authHeaders() }); if (r2.ok) { const convs = await r2.json(); const nc = convs.find(c => c.id === res.conversation_id); if (nc) openConversation(nc); } } } catch { }
  };
  const handleStartDMWithFriend = async (friend) => { await startDirectMessage({ id: friend.intraId || friend.id, login: friend.login || friend.username, username: friend.nickname || friend.login || friend.username }); };

  const openConversation = async (conv) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setSelectedConv(conv); setLoadingMessages(true);
    if (isMobile) setShowChannelSidebar(false);
    try { const res = await fetch(`${apiBaseUrl}/api/chat/conversations/${conv.id}/messages?limit=100`, { headers: authHeaders() }); if (res.ok) { const data = await res.json(); data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); setMessages(data); } } finally { setLoadingMessages(false); }
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsBase = apiBaseUrl.replace(/\/$/, '').replace(/^http/, wsProto);
    const ws = new WebSocket(`${wsBase}/ws/chat/${conv.id}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus("connected"); ws.onclose = () => setWsStatus("disconnected"); ws.onerror = () => { };
    ws.onmessage = (ev) => handleWsMessage(JSON.parse(ev.data));
  };

  const handleWsMessage = (data) => {
    switch (data.type) {
      case "message": setMessages(p => { if (p.some(m => m.id == data.message.id)) return p; return [...p, data.message].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); }); break;
      case "message_edited": setMessages(p => p.map(m => m.id === data.message.id ? data.message : m)); break;
      case "message_deleted": setMessages(p => p.map(m => m.id === data.message_id ? { ...m, deleted: true, content: "Message deleted" } : m)); break;
      case "reaction_added": setMessages(p => p.map(m => { if (m.id !== data.message_id) return m; const rx = m.reactions || []; if (rx.some(r => r.emoji === data.emoji && r.user_id === data.user_id)) return m; return { ...m, reactions: [...rx, { emoji: data.emoji, user_id: data.user_id }] }; })); break;
      case "reaction_removed": setMessages(p => p.map(m => { if (m.id !== data.message_id) return m; return { ...m, reactions: (m.reactions || []).filter(r => !(r.emoji === data.emoji && r.user_id === data.user_id)) }; })); break;
      case "presence": setOnlineUserIds(p => { const s = new Set(p); if (data.status === 'online') s.add(data.user_id); else s.delete(data.user_id); return s; }); break;
      case "typing": setTypingUsers(p => { const s = new Set(p); if (data.is_typing) s.add(data.user_id); else s.delete(data.user_id); return s; }); break;
      case "read_receipt": setMessages(p => p.map(m => m.id === data.message_id ? { ...m, read_at: data.read_at } : m)); break;
      case "error": if (data.code === 'blocked') alert("You are blocked by this user."); else if (data.code === 'blocking') alert("Unblock this user to send messages."); break;
      default: break;
    }
  };

  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "typing", is_typing: true }));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "typing", is_typing: false })); }, 2000);
  };
  const handleSendMessage = async (text, file) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    let attachmentUrl = null;
    if (file) { if (file.size > 1 * 1024 * 1024) { alert("File too large (max 1MB)."); return; } try { const fd = new FormData(); fd.append("file", file); const res = await fetch(`${apiBaseUrl}/api/chat/upload`, { method: "POST", headers: authHeaders({}, { json: false }), body: fd }); if (!res.ok) { alert("Upload failed."); return; } attachmentUrl = (await res.json()).url; } catch { alert("Upload error."); return; } }
    wsRef.current.send(JSON.stringify({ type: "send_message", content: text, attachment_url: attachmentUrl, client_temp_id: `temp-${Date.now()}` }));
  };
  const handleEditMessage = (msg) => { const t = prompt("Edit message:", msg.content); if (t && t !== msg.content && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "edit_message", message_id: msg.id, content: t })); };
  const handleDeleteMessage = (msg) => { if (confirm("Delete this message?") && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "delete_message", message_id: msg.id })); };
  const handleReactionAdd = (id, emoji) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "add_reaction", message_id: id, emoji })); };
  const handleReactionRemove = (id, emoji) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "remove_reaction", message_id: id, emoji })); };

  useEffect(() => { const init = async () => { await loadMe(); await syncTeams(); await loadConversations(); await loadBlockedUsers(); await loadFriends(); }; init(); return () => wsRef.current?.close(); }, [token]);

  const members = (() => { const m = new Map(); if (me) m.set(me.id, { id: me.id, username: me.username }); messages.forEach(msg => { if (msg.sender_id && !m.has(msg.sender_id)) m.set(msg.sender_id, { id: msg.sender_id, username: msg.sender_username || `User ${msg.sender_id}` }); }); return Array.from(m.values()); })();

  return (
    <div className="chat-layout">
      {!isMobile && <ServerSidebar onSettingsClick={() => setShowTokenModal(true)} user={me} />}
      {isMobile && showChannelSidebar && <div className="sidebar-overlay" onClick={() => setShowChannelSidebar(false)} />}
      <div className={`channel-sidebar-wrapper ${isMobile ? (showChannelSidebar ? 'open' : 'closed') : ''}`}>
        <ChannelList user={me} conversations={conversations} selectedConv={selectedConv} onSelectConv={openConversation} onCreateDM={() => setShowSearchModal(true)} friends={friends} onStartDM={handleStartDMWithFriend} onlineUserIds={onlineUserIds} isMobile={isMobile} onClose={() => setShowChannelSidebar(false)} />
      </div>

      <div className="chat-main-area">
        <header className="chat-header-bar">
          <div className="chat-header-left">
            {isMobile && (
              <button className="header-icon-btn menu-btn" onClick={() => setShowChannelSidebar(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              </button>
            )}
            {selectedConv ? (
              <div className="chat-header-title">
                <span className="hash-icon">#</span>
                <span className="channel-name-text">{selectedConv.name || 'channel'}</span>
                <span className={`status-badge ${wsStatus}`}>{wsStatus}</span>
              </div>
            ) : <span className="no-channel-text">Select a channel</span>}
          </div>
          <div className="chat-header-right">
            {selectedConv && (
              <button className={`header-icon-btn ${showMembersPanel ? 'active' : ''}`} onClick={() => setShowMembersPanel(!showMembersPanel)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
              </button>
            )}
          </div>
        </header>
        {selectedConv ? (
          <>
            <MessageList messages={messages} currentUserId={me?.id} onReactionAdd={handleReactionAdd} onReactionRemove={handleReactionRemove} onEdit={handleEditMessage} onDelete={handleDeleteMessage} typingUsers={typingUsers} loading={loadingMessages} />
            <MessageInput onSendMessage={handleSendMessage} channelName={selectedConv.name} onTyping={handleTyping} />
          </>
        ) : (
          <div className="empty-state-container">
            <div className="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" /></svg></div>
            <h3 className="empty-state-title">No channel selected</h3>
            <p className="empty-state-desc">Pick a channel or friend to start chatting</p>
            {isMobile && <button className="empty-state-btn" onClick={() => setShowChannelSidebar(true)}>Open Channels</button>}
          </div>
        )}
      </div>

      {showMembersPanel && selectedConv && (
        <>{isTablet && <div className="sidebar-overlay" onClick={() => setShowMembersPanel(false)} />}
          <div className={`members-panel-wrapper ${isTablet ? 'overlay-mode' : ''}`}>
            <UserList members={members} onlineUserIds={onlineUserIds} currentUserId={me?.id} blockedUsers={blockedUsers}
              onBlockUser={async (uid) => { await postJSON(`${apiBaseUrl}/api/users/block/${uid}`, {}, "POST"); setBlockedUsers(p => new Set(p).add(uid)); }}
              onUnblockUser={async (uid) => { await fetch(`${apiBaseUrl}/api/users/block/${uid}`, { method: "DELETE", headers: authHeaders() }); setBlockedUsers(p => { const s = new Set(p); s.delete(uid); return s; }); }}
              isOverlay={isTablet} onClose={() => setShowMembersPanel(false)} />
          </div>
        </>
      )}

      {showTokenModal && (
        <div className="modal-backdrop" onClick={() => setShowTokenModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Settings</h3><button className="modal-close-btn" onClick={() => setShowTokenModal(false)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
            <div className="modal-body"><label className="modal-label">JWT Token</label><input value={token} onChange={e => saveToken(e.target.value)} className="modal-input mono" placeholder="Paste your JWT token..." /></div>
            <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowTokenModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {showSearchModal && (
        <div className="modal-backdrop" onClick={() => setShowSearchModal(false)}>
          <div className="modal-container search-modal" onClick={e => e.stopPropagation()}>
            <div className="search-modal-input-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input autoFocus type="text" placeholder="Search for a user..." className="search-modal-input" value={searchQuery} onChange={e => handleSearchUsers(e.target.value)} />
              <button className="search-modal-close" onClick={() => setShowSearchModal(false)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
            </div>
            <div className="search-modal-results">
              {searchResults.length === 0 && searchQuery.length > 1 && <div className="search-empty">No users found.</div>}
              {searchResults.map(u => (
                <button key={u.id} onClick={() => startDirectMessage(u)} className="search-result-item">
                  <div className="search-result-avatar">{u.login ? u.login.substring(0, 2).toUpperCase() : 'U'}</div>
                  <div className="search-result-info"><div className="search-result-name">{u.login}</div><div className="search-result-sub">{u.displayName || 'User'}</div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}