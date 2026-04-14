import React, { useEffect, useState, useRef } from "react";
import './index.css';
import ChannelList from './components/ChannelList';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import UserList from './components/UserList';

const MAIN_API = import.meta.env.VITE_API_URL || 'https://localhost:8443/api';
const CHAT_API = import.meta.env.VITE_CHAT_API_URL || 'https://localhost:8443/chat';
const getMainAppUser = () => { try { const raw = sessionStorage.getItem('user'); return raw ? JSON.parse(raw) : null; } catch { return null; } };

export default function ChatPage({ apiBaseUrl = CHAT_API, isVisible = true, onMenuOpen }) {
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showChannelSidebar, setShowChannelSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);
  const [token, setToken] = useState(() => sessionStorage.getItem("token") || "");
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
  const [toasts, setToasts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // { msg }
  const typingTimeoutRef = useRef(null);
  const wsRef = useRef(null);
  const meRef = useRef(null);
  const toastIdRef = useRef(0);
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;
  const layoutRef = useRef(null);

  const showToast = (text, type = 'error') => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  useEffect(() => {
    const el = layoutRef.current;
    if (!el) return;
    const update = (w) => {
      const mobile = w < 700;
      const tablet = w < 1000;
      setIsMobile(mobile);
      setIsTablet(tablet);
      if (!mobile) setShowChannelSidebar(false);
    };
    const ro = new ResizeObserver(([e]) => update(e.contentRect.width));
    ro.observe(el);
    update(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const authHeaders = (extra = {}, options = { json: true }) => {
    const h = { ...(options.json ? { "Content-Type": "application/json" } : {}), ...extra };
    if (token?.trim()) h.Authorization = `Bearer ${token.trim()}`;
    return h;
  };
  const saveToken = (t) => { const s = t?.trim() || ""; setToken(s); };
  const postJSON = async (url, body, method = "POST") => {
    try { const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) }); if (!res.ok) return null; return await res.json(); } catch { return null; }
  };

  const loadMe = async () => {
    if (!token) { setMe(null); return; }
    let profileData = getMainAppUser();
    try { const res = await fetch(`${MAIN_API}/profile`, { headers: { Authorization: `Bearer ${token.trim()}` } }); if (res.ok) profileData = await res.json(); } catch { }
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/me`, { headers: authHeaders() });
      if (res.ok) { const cu = await res.json(); setMe({ ...(profileData || {}), id: cu.id, username: profileData?.login || profileData?.username || cu.username || '' }); setOnlineUserIds(p => new Set(p).add(cu.id)); }
      else if (profileData) setMe(profileData); else setMe(null);
    } catch { if (profileData) setMe(profileData); else setMe(null); }
  };
  const loadConversations = async () => { if (!token) return; const res = await fetch(`${apiBaseUrl}/api/chat/conversations`, { headers: authHeaders() }); if (res.ok) setConversations(await res.json()); };
  const syncTeams = async () => { if (!token) return; try { const res = await fetch(`${apiBaseUrl}/api/chat/conversations/sync_teams`, { method: "POST", headers: authHeaders() }); if (res.ok) await loadConversations(); } catch { } };
  const loadBlockedUsers = async () => { if (!token) return; try { const res = await fetch(`${apiBaseUrl}/api/users/blocked`, { headers: authHeaders() }); if (res.ok) { const users = await res.json(); setBlockedUsers(new Set(users.map(u => u.id))); } } catch { } };
  const loadFriends = async () => {
    if (!token) return;
    try { const res = await fetch(`${apiBaseUrl}/api/chat/friends`, { headers: authHeaders() }); if (res.ok) { const data = await res.json(); setFriends(data.map(f => ({ id: f.friend_id, login: f.friend_login, nickname: f.friend_nickname, effectiveAvatar: f.friend_avatar, displayName: f.friend_display_name }))); return; } } catch { }
    try { const res = await fetch(`${MAIN_API}/friends`, { headers: { Authorization: `Bearer ${token.trim()}` } }); if (res.ok) { const data = await res.json(); setFriends(data.map(f => ({ ...f, effectiveAvatar: f.customAvatar || f.avatar }))); } } catch { }
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
    if (isTablet) setShowChannelSidebar(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/conversations/${conv.id}/messages?limit=100`, { headers: authHeaders() });
      console.log('[CHAT] messages fetch status:', res.status);
      if (res.ok) { const data = await res.json(); data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); setMessages(data); }
    } finally { setLoadingMessages(false); }
    const wsOrigin = window.location.origin.replace(/^https/, 'wss').replace(/^http/, 'ws');
    const wsUrl = `${wsOrigin}/ws/chat/${conv.id}?token=${token}`;
    console.log('[CHAT] token empty?', !token, '| WS URL:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log('[CHAT] WS connected'); setWsStatus("connected");
      // mark last message as read on open (only when panel is visible)
      if (isVisibleRef.current) setTimeout(() => {
        setMessages(cur => {
          const last = cur.filter(m => !String(m.id).startsWith('temp-') && m.sender_id !== meRef.current?.id).slice(-1)[0];
          if (last && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'mark_read', message_id: last.id }));
          return cur;
        });
        // reload conversations to clear this channel's unread badge
        loadConversations();
      }, 500);
    };
    ws.onclose = (e) => { console.log('[CHAT] WS closed code:', e.code, 'reason:', e.reason); setWsStatus("disconnected"); };
    ws.onerror = (e) => { console.error('[CHAT] WS error:', e); };
    ws.onmessage = (ev) => { console.log('[CHAT] WS message:', ev.data); handleWsMessage(JSON.parse(ev.data)); };
  };

  const handleWsMessage = (data) => {
    switch (data.type) {
      case "message": setMessages(p => { const withoutTemp = p.filter(m => !(String(m.id).startsWith('temp-') && m.content === data.message.content && m.sender_id === data.message.sender_id)); if (withoutTemp.some(m => m.id == data.message.id)) return withoutTemp; return [...withoutTemp, data.message].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); });
        if (data.message.sender_id !== meRef.current?.id) {
          if (!isVisibleRef.current) {
            // only notify when the chat panel is not shown
            window.dispatchEvent(new CustomEvent('chatNewMessage', { detail: data.message }));
            // bump unread_count for this conversation locally
            setConversations(prev => prev.map(c => c.id === data.message.conversation_id ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c));
          } else if (wsRef.current?.readyState === WebSocket.OPEN) {
            // auto mark read when chat is open and visible
            wsRef.current.send(JSON.stringify({ type: 'mark_read', message_id: data.message.id }));
          }
        }
        break;
      case "message_edited": setMessages(p => p.map(m => m.id === data.message.id ? data.message : m)); break;
      case "message_deleted": setMessages(p => p.map(m => m.id === data.message_id ? { ...m, deleted: true, content: "Message deleted" } : m)); break;
      case "reaction_added": setMessages(p => p.map(m => { if (m.id !== data.message_id) return m; const rx = m.reactions || []; if (rx.some(r => r.emoji === data.emoji && r.user_id === data.user_id)) return m; return { ...m, reactions: [...rx, { emoji: data.emoji, user_id: data.user_id }] }; })); break;
      case "reaction_removed": setMessages(p => p.map(m => { if (m.id !== data.message_id) return m; return { ...m, reactions: (m.reactions || []).filter(r => !(r.emoji === data.emoji && r.user_id === data.user_id)) }; })); break;
      case "presence": setOnlineUserIds(p => { const s = new Set(p); if (data.status === 'online') s.add(data.user_id); else s.delete(data.user_id); return s; }); break;
      case "typing": setTypingUsers(p => { const s = new Set(p); if (data.is_typing) s.add(data.user_id); else s.delete(data.user_id); return s; }); break;
      case "read_receipt": setMessages(p => p.map(m => m.id === data.message_id ? { ...m, read_at: data.read_at } : m)); break;
      case "ack": setMessages(p => p.map(m => String(m.id) === String(data.client_temp_id) ? { ...m, id: data.message_id, created_at: data.created_at || m.created_at } : m)); break;
      case "error": if (data.code === 'blocked') showToast("You are blocked by this user."); else if (data.code === 'blocking') showToast("Unblock this user to send messages."); else if (data.message) showToast(data.message); break;
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
    console.log('[CHAT] send attempt, WS state:', wsRef.current?.readyState, '(1=OPEN)');
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    let attachmentUrl = null;
    if (file) { if (file.size > 1 * 1024 * 1024) { showToast("File too large (max 1MB)."); return; } try { const fd = new FormData(); fd.append("file", file); const res = await fetch(`${apiBaseUrl}/api/chat/upload`, { method: "POST", headers: authHeaders({}, { json: false }), body: fd }); if (!res.ok) { showToast("Upload failed."); return; } attachmentUrl = (await res.json()).url; } catch { showToast("Upload error."); return; } }
    const tempId = `temp-${Date.now()}`;
    const myAvatar = me?.customAvatar || me?.avatar || me?.image?.link || me?.image?.versions?.medium || null;
    setMessages(p => [...p, { id: tempId, sender_id: me?.id, sender_username: me?.username, sender_avatar: myAvatar, content: text, attachment_url: attachmentUrl, created_at: new Date().toISOString(), reactions: [] }]);
    wsRef.current.send(JSON.stringify({ type: "send_message", content: text, attachment_url: attachmentUrl, client_temp_id: tempId }));
  };
  const handleEditMessage = (msg) => { setEditingId(msg.id); };
  const handleDeleteMessage = (msg) => { setDeleteModal({ msg }); };
  const submitEdit = (msgId, value, originalContent) => {
    if (value.trim() && value.trim() !== originalContent && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "edit_message", message_id: msgId, content: value.trim() }));
    }
    setEditingId(null);
  };
  const submitDelete = () => {
    if (deleteModal && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "delete_message", message_id: deleteModal.msg.id }));
    }
    setDeleteModal(null);
  };
  const handleReactionAdd = (id, emoji) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "add_reaction", message_id: id, emoji })); };
  const handleReactionRemove = (id, emoji) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "remove_reaction", message_id: id, emoji })); };

  useEffect(() => { meRef.current = me; }, [me]);
  // tell FullDashboard to clear the badge whenever the chat panel becomes visible
  useEffect(() => { if (isVisible) window.dispatchEvent(new Event('chatRead')); }, [isVisible]);

  useEffect(() => { const handler = (e) => showToast(e.detail); window.addEventListener('chatToast', handler); return () => window.removeEventListener('chatToast', handler); }, []);

  const loadOnlineUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/online_users`, { headers: authHeaders() });
      if (res.ok) {
        const ids = await res.json();
        setOnlineUserIds(prev => {
          const s = new Set(ids);
          if (meRef.current?.id) s.add(meRef.current.id);
          return s;
        });
      }
    } catch { }
  };

  useEffect(() => { const init = async () => { await loadMe(); await syncTeams(); await loadConversations(); await loadBlockedUsers(); await loadFriends(); await loadOnlineUsers(); }; init(); return () => wsRef.current?.close(); }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      loadFriends();
      loadConversations();
      loadOnlineUsers();
    }, 30000);
    return () => clearInterval(id);
  }, [token]);

  const members = (() => { const m = new Map(); if (me) m.set(me.id, { id: me.id, username: me.username }); messages.forEach(msg => { if (msg.sender_id && !m.has(msg.sender_id)) m.set(msg.sender_id, { id: msg.sender_id, username: msg.sender_username || `User ${msg.sender_id}` }); }); return Array.from(m.values()); })();
  const membersById = Object.fromEntries(members.map(u => [u.id, u.username]));

  return (
    <div className="chat-layout" ref={layoutRef}>
      {isTablet && showChannelSidebar && <div className="sidebar-overlay" onClick={() => setShowChannelSidebar(false)} />}
      <div className={`channel-sidebar-wrapper ${isTablet ? (showChannelSidebar ? 'open' : 'closed') : ''}`}>
        <ChannelList user={me} conversations={conversations} selectedConv={selectedConv} onSelectConv={openConversation} onCreateDM={() => setShowSearchModal(true)} friends={friends} onStartDM={handleStartDMWithFriend} onlineUserIds={onlineUserIds} isMobile={isMobile || isTablet} onClose={() => setShowChannelSidebar(false)} />
      </div>

      <div className="chat-main-area" onClick={() => { if (isTablet) { setShowChannelSidebar(false); setShowMembersPanel(false); } }}>
        <header className="chat-header-bar">
          <div className="chat-header-left">
            {onMenuOpen && (
              <button className="header-icon-btn menu-btn" title="Menu" onClick={(e) => { e.stopPropagation(); onMenuOpen(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              </button>
            )}
            {isTablet && (
              <button className="header-icon-btn menu-btn" title="Channels" onClick={(e) => { e.stopPropagation(); setShowChannelSidebar(v => !v); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
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
              <button className={`header-icon-btn ${showMembersPanel ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setShowMembersPanel(!showMembersPanel); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
              </button>
            )}
          </div>
        </header>
        {selectedConv ? (
          <>
            <MessageList messages={messages} currentUserId={me?.id} onReactionAdd={handleReactionAdd} onReactionRemove={handleReactionRemove} onEdit={handleEditMessage} onDelete={handleDeleteMessage} typingUsers={typingUsers} membersById={membersById} loading={loadingMessages} editingId={editingId} onEditSubmit={submitEdit} onEditCancel={() => setEditingId(null)} />
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

      {/* ── Delete confirm modal ── */}
      {deleteModal && (
        <div className="cp-modal-backdrop" onClick={() => setDeleteModal(null)}>
          <div className="cp-modal cp-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-header">
              <span>Delete message</span>
              <button className="cp-modal-x" onClick={() => setDeleteModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <p className="cp-modal-desc">This message will be permanently deleted.</p>
            <div className="cp-modal-footer">
              <button className="cp-btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="cp-btn-danger" onClick={submitDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast stack ── */}
      <div className="cp-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`cp-toast cp-toast-${t.type}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <style>{`
        .cp-modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 16px;
          animation: fadeIn 0.15s ease;
        }
        .cp-modal {
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl);
          width: 100%; max-width: 420px;
          box-shadow: var(--shadow-lg);
          animation: modalSlideUp 0.2s cubic-bezier(0.34,1.56,0.64,1);
          overflow: hidden;
        }
        .cp-modal-sm { max-width: 340px; }
        .cp-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px;
          font-weight: 700; font-size: 15px; color: var(--text-primary);
        }
        .cp-modal-x {
          width: 28px; height: 28px; border-radius: var(--radius-sm);
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all var(--transition);
        }
        .cp-modal-x:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cp-modal-textarea {
          width: 100%; resize: vertical; min-height: 80px;
          background: var(--bg-deep); border: 1px solid var(--border-strong);
          border-radius: var(--radius-md); color: var(--text-primary);
          font-size: 14px; font-family: inherit; line-height: 1.5;
          padding: 10px 14px; margin: 0 20px; width: calc(100% - 40px);
          transition: border-color var(--transition);
        }
        .cp-modal-textarea:focus { border-color: var(--accent); }
        .cp-modal-desc {
          padding: 0 20px 4px; font-size: 14px; color: var(--text-secondary);
        }
        .cp-modal-footer {
          display: flex; gap: 8px; justify-content: flex-end;
          padding: 14px 20px 18px;
        }
        .cp-btn-ghost {
          padding: 8px 18px; background: transparent;
          border: 1px solid var(--border-strong); border-radius: var(--radius-md);
          color: var(--text-secondary); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all var(--transition); font-family: inherit;
        }
        .cp-btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cp-btn-primary {
          padding: 8px 18px; background: var(--accent);
          border: none; border-radius: var(--radius-md);
          color: white; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background var(--transition); font-family: inherit;
        }
        .cp-btn-primary:hover { background: var(--accent-hover); }
        .cp-btn-danger {
          padding: 8px 18px; background: var(--danger);
          border: none; border-radius: var(--radius-md);
          color: white; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: opacity var(--transition); font-family: inherit;
        }
        .cp-btn-danger:hover { opacity: 0.85; }

        /* Toasts */
        .cp-toasts {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; gap: 8px;
          z-index: 300; pointer-events: none; align-items: center;
        }
        .cp-toast {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 500;
          box-shadow: var(--shadow-md);
          animation: slideUp 0.2s ease, fadeOut 0.4s ease 3.1s forwards;
          pointer-events: auto;
        }
        .cp-toast-error { background: #2d1a1a; border: 1px solid var(--danger); color: #f87171; }
        .cp-toast-info  { background: var(--bg-elevated); border: 1px solid var(--border-strong); color: var(--text-secondary); }
        @keyframes fadeOut { from { opacity:1; } to { opacity:0; transform: translateY(6px); } }
      `}</style>
    </div>
  );
}