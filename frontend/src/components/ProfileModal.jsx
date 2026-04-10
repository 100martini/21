import React, { useState, useEffect, useRef } from 'react';
import { getToken } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ProfileModal = ({ user: userProp, onClose, onUserUpdate }) => {
  const [profileNickname, setProfileNickname] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatarPreview, setProfileAvatarPreview] = useState(null);
  const [profileAvatarData, setProfileAvatarData] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const justSavedRef = useRef(false);

  const username = userProp?.login || 'user';
  const avatarUrl = userProp?.customAvatar || userProp?.avatar || userProp?.image?.link || userProp?.image?.versions?.medium;
  const is42User = !!userProp?.intraId;
  const campus = userProp?.campus || 'Campus';

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  useEffect(() => {
    if (userProp) {
      if (justSavedRef.current) { justSavedRef.current = false; return; }
      setProfileNickname(userProp.nickname || '');
      setProfileBio(userProp.bio || '');
      setProfileAvatarPreview(null);
      setProfileAvatarData(null);
      setProfileError(null);
      setProfileSuccess(null);
    }
  }, [userProp]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    if (file.size > 2 * 1024 * 1024) { setProfileError('Image must be smaller than 2MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { setProfileError('Use JPEG, PNG, GIF, or WebP format'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setProfileAvatarPreview(ev.target.result); setProfileAvatarData(ev.target.result); setProfileError(null); setProfileSuccess(null); };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true); setProfileError(null); setProfileSuccess(null);
    try {
      const token = getToken(); const body = {};
      const newNickname = profileNickname.trim();
      if (newNickname !== (userProp?.nickname || '')) body.nickname = newNickname;
      if (!is42User) {
        const newBio = profileBio.trim();
        if (newBio !== (userProp?.bio || '')) body.bio = newBio;
      }
      if (profileAvatarData) body.customAvatar = profileAvatarData;
      if (Object.keys(body).length === 0) { setProfileError('No changes to save'); setProfileSaving(false); return; }
      const r = await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Failed to save');
      justSavedRef.current = true;
      if (onUserUpdate) onUserUpdate(data);
      if (body.nickname !== undefined && body.customAvatar) setProfileSuccess('Nickname and avatar updated!');
      else if (body.nickname !== undefined) setProfileSuccess(body.nickname === '' ? 'Nickname removed' : 'Nickname changed');
      else if (body.customAvatar) setProfileSuccess('Avatar updated');
      else if (body.bio !== undefined) setProfileSuccess('Bio updated!');
      setProfileAvatarData(null); setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err) { setProfileError(err.message); }
    setProfileSaving(false);
  };

  const handleResetAvatar = async () => {
    setProfileSaving(true);
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ customAvatar: null }) });
      const data = await r.json();
      if (r.ok) {
        justSavedRef.current = true;
        if (onUserUpdate) onUserUpdate(data);
        setProfileAvatarPreview(null); setProfileAvatarData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setProfileSuccess('Avatar reset to intra photo'); setTimeout(() => setProfileSuccess(null), 4000);
      }
    } catch (err) { setProfileError('Failed to reset avatar'); }
    setProfileSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <div className="profile-modal-banner">
          <button className="profile-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="profile-modal-avatar-area">
          <div className="profile-modal-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
            {profileAvatarPreview
              ? <img src={profileAvatarPreview} alt="Preview" className="profile-modal-avatar-img" />
              : avatarUrl
              ? <img src={avatarUrl} alt={username} className="profile-modal-avatar-img" />
              : <div className="profile-modal-avatar-placeholder">{getInitials(username)}</div>}
            <div className="profile-modal-avatar-hover">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
          {is42User && userProp?.customAvatar && (
            <button className="btn-reset-avatar" onClick={handleResetAvatar} disabled={profileSaving}>Reset to intra photo</button>
          )}
        </div>
        <div className="profile-modal-body">
          <div className="profile-identity">
            <div className="profile-identity-name">{userProp?.nickname || userProp?.displayName || username}</div>
            <div className="profile-identity-login">@{username}</div>
          </div>
          <div className="profile-edit-section">
            <label className="profile-label">Nickname</label>
            <input type="text" className="profile-input" value={profileNickname} onChange={(e) => setProfileNickname(e.target.value)} placeholder="Choose a nickname..." maxLength={20} />
            <span className="profile-hint">{profileNickname.length}/20 · Letters, numbers, _ and -</span>
          </div>
          {!is42User && (
            <div className="profile-edit-section">
              <label className="profile-label">Bio</label>
              <textarea className="profile-input" value={profileBio} onChange={(e) => setProfileBio(e.target.value)} placeholder="Tell us a bit about yourself..." maxLength={160} rows={3} style={{ resize: 'none' }} />
              <span className="profile-hint">{profileBio.length}/160</span>
            </div>
          )}
          <div className="profile-divider"></div>
          {is42User ? (
            <>
              <div className="profile-readonly-title">42 Intra Info</div>
              <div className="profile-info-grid">
                <div className="profile-field-readonly"><label className="profile-label">Full Name</label><div className="profile-value">{userProp?.displayName || '—'}</div></div>
                <div className="profile-field-readonly"><label className="profile-label">Login</label><div className="profile-value">@{username}</div></div>
                <div className="profile-field-readonly"><label className="profile-label">Email</label><div className="profile-value">{userProp?.email || '—'}</div></div>
                <div className="profile-field-readonly"><label className="profile-label">Campus</label><div className="profile-value">{campus}</div></div>
              </div>
            </>
          ) : (
            <>
              <div className="profile-readonly-title">Account Info</div>
              <div className="profile-info-grid">
                <div className="profile-field-readonly"><label className="profile-label">Email</label><div className="profile-value">{userProp?.email || '—'}</div></div>
                <div className="profile-field-readonly"><label className="profile-label">Member Since</label><div className="profile-value">{userProp?.createdAt ? new Date(userProp.createdAt).toLocaleDateString() : '—'}</div></div>
              </div>
            </>
          )}
        {profileError && <div className="profile-message error">{profileError}</div>}
        {profileSuccess && <div className="profile-message success">{profileSuccess}</div>}
        </div>
        <div className="profile-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className={`btn-primary ${profileSaving ? 'btn-disabled' : ''}`} onClick={handleProfileSave} disabled={profileSaving}>
            {profileSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;