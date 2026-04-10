import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { removeToken, getToken } from '../utils/auth';
import { connectSocket, disconnectSocket } from '../utils/socket';
import '../styles/FullDashboard.css';
import '../styles/Congrats.css';
import '../styles/Profilefriends.css';
import ProfileModal from './ProfileModal';
import LegalModal from './LegalModal';
import Sidebar from './Sidebar';
import ChatPage from '../chat/ChatPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const FullDashboard = ({ user: userProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [activeSection, setActiveSection] = useState('oc');
  const [teamName, setTeamName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showInvites, setShowInvites] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState(null);
  const [showLegal, setShowLegal] = useState(false);

  const [customProjects, setCustomProjects] = useState([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', minTeam: 1, maxTeam: 1, deadline: '' });
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState(null);
  const [newProjectMembers, setNewProjectMembers] = useState([]);
  const [newProjectSearch, setNewProjectSearch] = useState('');
  const [newProjectSearchResults, setNewProjectSearchResults] = useState([]);
  const [newProjectSearching, setNewProjectSearching] = useState(false);

  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const [memberToRemove, setMemberToRemove] = useState(null);
  const [showRemoveMember, setShowRemoveMember] = useState(false);
  const [teamForMemberRemoval, setTeamForMemberRemoval] = useState(null);

  const [activeView, setActiveView] = useState(() => sessionStorage.getItem('dashboardView') || 'dashboard');
  const activeViewRef = useRef(activeView);
  const leftChatAtRef = useRef(0);
  const [showProfile, setShowProfile] = useState(false);

  const [freshUser, setFreshUser] = useState(null);
  const user = freshUser || userProp;

  const [profileNickname, setProfileNickname] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatarPreview, setProfileAvatarPreview] = useState(null);
  const [profileAvatarData, setProfileAvatarData] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const justSavedRef = useRef(false);

  const [friends, setFriends] = useState([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendSearching, setFriendSearching] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState('');
  const [addUserResults, setAddUserResults] = useState([]);
  const [addUserSearching, setAddUserSearching] = useState(false);
  const [friendsTab, setFriendsTab] = useState('friends');
  const [showDeleteFriendConfirm, setShowDeleteFriendConfirm] = useState(false);
  const [friendToDelete, setFriendToDelete] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const addToast = useCallback((title, body, onClick = null) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, title, body, onClick }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exit: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 4000);
  }, []);

  const username = user?.login || 'user';
  const effectiveAvatar = user?.customAvatar || user?.avatar || user?.image?.link || user?.image?.versions?.medium;
  const avatarUrl = effectiveAvatar;
  const userProjects = user?.projectsUsers || [];
  const currentCircle = user?.currentCircle ?? 0;
  const curriculum = user?.curriculum || 'unknown';
  const campus = user?.campus || 'Campus';
  const wallet = user?.wallet || 0;
  const correctionPoints = user?.correctionPoints || user?.correction_point || 0;
  const level = user?.level || user?.cursusUsers?.find(c => c.cursus?.slug === '42cursus')?.level || 0;
  const is42User = !!user?.intraId;
  const currentUserId = user?.id;
  const addUserSearchRef = useRef('');

  useEffect(() => {
    addUserSearchRef.current = addUserSearch;
  }, [addUserSearch]);

  const grade = useMemo(() => {
    const cursus42 = user?.cursusUsers?.find(c => c.cursus?.slug === '42cursus' || c.cursus_id === 21);
    return cursus42?.grade || user?.grade || 'Cadet';
  }, [user]);

  const isCadet = grade === 'Cadet';
  const isTranscender = grade === 'Transcender' || grade === 'Member';

  useEffect(() => {
    sessionStorage.setItem('dashboardView', activeView);
    if (activeView === 'chat') setUnreadChatCount(0);
  }, [activeView]);

  useEffect(() => {
    const onChatMessage = (e) => {
      if (activeView !== 'chat') {
        setUnreadChatCount(prev => prev + 1);
        const msg = e.detail;
        addToast(
          msg?.sender_username || 'New message',
          msg?.content || '📎 Attachment',
          () => handleNavClick('chat')
        );
      }
    };
    // when user switches to chat or reads a message, clear badge immediately
    const onChatRead = () => { setUnreadChatCount(0); };
    window.addEventListener('chatNewMessage', onChatMessage);
    window.addEventListener('chatRead', onChatRead);
    return () => {
      window.removeEventListener('chatNewMessage', onChatMessage);
      window.removeEventListener('chatRead', onChatRead);
    };
  }, [activeView, addToast]);

  useEffect(() => {
    if (location.state?.openProfile) {
      setShowProfile(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleNavClick = (view) => {
    if (activeViewRef.current === 'chat' && view !== 'chat') leftChatAtRef.current = Date.now();
    setActiveView(view); activeViewRef.current = view; setSidebarOpen(false);
  };

  const fetchFreshUser = useCallback(async () => {
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) setFreshUser(await r.json());
    } catch (err) { console.error('Failed to refresh user data'); }
  }, []);

  const silentSync = useCallback(async () => {
    if (!user?.intraId) return;
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/auth/sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) await fetchFreshUser();
    } catch (err) {}
  }, [fetchFreshUser, user]);

  const fetchCustomProjects = useCallback(async () => {
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/projects/my-custom`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) setCustomProjects(await r.json());
    } catch (err) { console.error('Failed to fetch custom projects'); }
  }, []);

  const fetchProjects = async () => {
    try { const r = await fetch(`${API_URL}/projects`); if (r.ok) setAllProjects(await r.json()); }
    catch (err) { console.error('Failed to fetch projects'); }
    finally { setProjectsLoading(false); }
  };

  const fetchMyTeams = async () => {
    try { const token = getToken(); const r = await fetch(`${API_URL}/teams/my-teams`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setMyTeams(await r.json()); }
    catch (err) { console.error('Failed to fetch teams'); }
  };

  const fetchPendingInvites = async () => {
    try { const token = getToken(); const r = await fetch(`${API_URL}/teams/pending`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setPendingInvites(await r.json()); }
    catch (err) { console.error('Failed to fetch invites'); }
  };

  const fetchDeleteRequests = async () => {
    try { const token = getToken(); const r = await fetch(`${API_URL}/teams/delete-requests`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setDeleteRequests(await r.json()); }
    catch (err) { console.error('Failed to fetch delete requests'); }
  };

  const fetchFriends = async () => {
    try { const token = getToken(); const r = await fetch(`${API_URL}/friends`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setFriends(await r.json()); }
    catch (err) { console.error('Failed to fetch friends'); }
  };

  const fetchPendingFriendRequests = async () => {
    try { const token = getToken(); const r = await fetch(`${API_URL}/friends/pending`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setPendingFriendRequests(await r.json()); }
    catch (err) { console.error('Failed to fetch friend requests'); }
  };

  // ── CHAT: fetch unread count depuis le chat API ──────────────────────────────
  const fetchUnreadChatCount = async () => {
    if (activeViewRef.current === 'chat') { setUnreadChatCount(0); return; }
    // grace period: for 3s after leaving chat, suppress badge to let mark_read propagate
    if (Date.now() - leftChatAtRef.current < 3000) { setUnreadChatCount(0); return; }
    try {
      const token = getToken();
      const chatApiUrl = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000';
      const r = await fetch(`${chatApiUrl}/api/chat/unread_count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json();
        setUnreadChatCount(data.unread_count || 0);
      }
    } catch (err) { console.error('Failed to fetch unread chat count'); }
  };

  // Poll toutes les 10 secondes + écoute chatReadEvent
  useEffect(() => {
    fetchUnreadChatCount();
    const intervalId = setInterval(fetchUnreadChatCount, 4000);
    window.addEventListener('chatReadEvent', fetchUnreadChatCount);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('chatReadEvent', fetchUnreadChatCount);
    };
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    socket.off('friend:request');
    socket.off('friend:accepted');
    socket.off('friend:declined');
    socket.off('friend:removed');
    socket.off('team:invite');
    socket.off('team:response');
    socket.off('team:declined');
    socket.off('team:delete-request');
    socket.off('team:delete-response');
    socket.off('team:delete-rejected');
    socket.off('team:deleted');

    socket.on('friend:request', (data) => {
      addToast('Friend Request', `${data.from?.login || 'Someone'} sent you a friend request`, () => handleNavClick('friends'));
      fetchPendingFriendRequests();
    });
    socket.on('friend:accepted', () => {
      fetchFriends(); fetchPendingFriendRequests();
      if (addUserSearchRef.current.length >= 2) handleAddFriendSearch(addUserSearchRef.current);
    });
    socket.on('friend:declined', () => {
      fetchPendingFriendRequests();
      if (addUserSearchRef.current.length >= 2) handleAddFriendSearch(addUserSearchRef.current);
    });
    socket.on('friend:removed', () => {
      fetchFriends();
      if (addUserSearchRef.current.length >= 2) handleAddFriendSearch(addUserSearchRef.current);
    });

    socket.on('team:invite', (data) => {
      addToast('Team Invite', `${data.creatorLogin} invited you to "${data.teamName}" for ${data.projectName}`, () => { setShowInvites(true); handleNavClick('dashboard'); });
      fetchPendingInvites(); fetchMyTeams(); fetchCustomProjects();
    });
    socket.on('team:response', (data) => {
      addToast('Team Update', `${data.responderLogin} ${data.accepted ? 'accepted' : 'declined'} the invite to "${data.teamName}"`);
      fetchMyTeams(); fetchPendingInvites(); fetchCustomProjects();
    });
    socket.on('team:declined', (data) => {
      addToast('Team Update', `${data.responderLogin} declined the invite to "${data.teamName}"`);
      fetchMyTeams(); fetchPendingInvites(); fetchCustomProjects();
    });
    socket.on('team:delete-request', (data) => {
      addToast('Delete Request', `${data.requestedByLogin} wants to delete team "${data.teamName}"`, () => handleNavClick('dashboard'));
      fetchDeleteRequests(); fetchMyTeams(); fetchCustomProjects();
    });
    socket.on('team:delete-response', () => { fetchDeleteRequests(); fetchMyTeams(); fetchCustomProjects(); });
    socket.on('team:delete-rejected', () => { fetchDeleteRequests(); fetchMyTeams(); });
    socket.on('team:deleted', (data) => {
      addToast('Team Deleted', `Team "${data.teamName}" has been deleted`);
      fetchMyTeams(); fetchDeleteRequests(); fetchCustomProjects(); fetchPendingInvites();
    });

    return () => {
      socket.off('friend:request');
      socket.off('friend:accepted');
      socket.off('friend:declined');
      socket.off('friend:removed');
      socket.off('team:invite');
      socket.off('team:response');
      socket.off('team:declined');
      socket.off('team:delete-request');
      socket.off('team:delete-response');
      socket.off('team:delete-rejected');
      socket.off('team:deleted');
    };
  }, [addToast]);

  useEffect(() => {
    const init = async () => {
      await fetchFreshUser();
      fetchProjects(); fetchMyTeams(); fetchPendingInvites();
      fetchDeleteRequests(); fetchFriends(); fetchPendingFriendRequests();
      fetchCustomProjects(); silentSync();
    };
    init();
  }, []);

  useEffect(() => { if (activeView === 'friends') { fetchFriends(); fetchPendingFriendRequests(); } }, [activeView]);

  useEffect(() => {
    if (showProfile && user) {
      if (justSavedRef.current) { justSavedRef.current = false; return; }
      setProfileNickname(user.nickname || '');
      setProfileBio(user.bio || '');
      setProfileAvatarPreview(null); setProfileAvatarData(null); setProfileError(null); setProfileSuccess(null);
    }
  }, [showProfile, user]);

  const handleAddFriendSearch = useCallback(async (query) => {
    if (query.length < 2) { setAddUserResults([]); setAddUserSearching(false); return; }
    setAddUserSearching(true);
    try { const token = getToken(); const r = await fetch(`${API_URL}/friends/search-users?q=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setAddUserResults(await r.json()); }
    catch (err) { setAddUserResults([]); }
    setAddUserSearching(false);
  }, []);

  const handleFriendSearch = useCallback(async (query) => {
    if (query.length < 1) { setFriendSearchResults([]); setFriendSearching(false); return; }
    setFriendSearching(true);
    try { const token = getToken(); const r = await fetch(`${API_URL}/friends/search?q=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) setFriendSearchResults(await r.json()); }
    catch (err) { setFriendSearchResults([]); }
    setFriendSearching(false);
  }, []);

  const sendFriendRequest = async (userId) => {
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/friends/request`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      if (r.ok) { const data = await r.json(); if (data.autoAccepted) fetchFriends(); await fetchPendingFriendRequests(); if (addUserSearch.length >= 2) handleAddFriendSearch(addUserSearch); }
    } catch (err) { console.error('Failed to send friend request'); }
  };

  const respondToFriendRequest = async (friendshipId, accept) => {
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/friends/${friendshipId}/respond`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ accept }) });
      if (r.ok) {
        fetchFriends();
        fetchPendingFriendRequests();
        if (accept && addUserSearch.length >= 2) {
          handleAddFriendSearch(addUserSearch);
        } else {
          setAddUserResults([]);
          setAddUserSearch('');
        }
      }
    } catch (err) { console.error('Failed to respond to friend request'); }
  };

  const handleRemoveFriendClick = (friend) => { setFriendToDelete(friend); setShowDeleteFriendConfirm(true); };

  const confirmRemoveFriend = async () => {
    if (!friendToDelete) return;
    try { const token = getToken(); const r = await fetch(`${API_URL}/friends/${friendToDelete.friendshipId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) { fetchFriends(); fetchPendingFriendRequests(); setAddUserResults([]); setAddUserSearch(''); } }
    catch (err) { console.error('Failed to remove friend'); }
    setShowDeleteFriendConfirm(false); setFriendToDelete(null);
  };

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
      if (newNickname !== (user?.nickname || '')) body.nickname = newNickname;
      if (!is42User) {
        const newBio = profileBio.trim();
        if (newBio !== (user?.bio || '')) body.bio = newBio;
      }
      if (profileAvatarData) body.customAvatar = profileAvatarData;
      if (Object.keys(body).length === 0) { setProfileError('No changes to save'); setProfileSaving(false); return; }
      const r = await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Failed to save');
      justSavedRef.current = true;
      setFreshUser(prev => ({ ...prev, ...data }));
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
      if (r.ok) { justSavedRef.current = true; setFreshUser(prev => ({ ...prev, ...data })); setProfileAvatarPreview(null); setProfileAvatarData(null); if (fileInputRef.current) fileInputRef.current.value = ''; setProfileSuccess('Avatar reset to intra photo'); setTimeout(() => setProfileSuccess(null), 4000); }
    } catch (err) { setProfileError('Failed to reset avatar'); }
    setProfileSaving(false);
  };

  const handleLogout = useCallback(() => {
    disconnectSocket();
    removeToken(); sessionStorage.removeItem('user'); sessionStorage.removeItem('welcomeShown'); sessionStorage.removeItem('dashboardView');
    navigate('/login');
  }, [navigate]);

  const searchUsers = useCallback(async (query) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const token = getToken();
      let url;
      if (selectedProject?.isUserCreated) {
        url = `${API_URL}/auth/users/search-all?q=${encodeURIComponent(query)}`;
      } else {
        const params = new URLSearchParams({ q: query, curriculum, grade });
        if (selectedProject?.slug) params.append('projectSlug', selectedProject.slug);
        url = `${API_URL}/auth/users/search?${params}`;
      }
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) setSearchResults(await r.json());
    } catch (err) { setSearchResults([]); }
    setSearching(false);
  }, [curriculum, grade, selectedProject]);

  const searchNewProjectMembers = useCallback(async (query) => {
    if (query.length < 2) { setNewProjectSearchResults([]); return; }
    setNewProjectSearching(true);
    try {
      const r = await fetch(`${API_URL}/auth/users/search-all?q=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (r.ok) setNewProjectSearchResults(await r.json());
    } catch (err) { setNewProjectSearchResults([]); }
    setNewProjectSearching(false);
  }, []);

  const handleSearchChange = (e) => { const q = e.target.value; setSearchQuery(q); searchUsers(q); };

  const addMember = (member) => {
    const max = (selectedProject?.maxTeam || selectedProject?.minTeam || 2) - 1;
    if (selectedMembers.length >= max) return;
    if (!selectedMembers.find(m => m.id === member.id)) setSelectedMembers([...selectedMembers, member]);
    setSearchQuery(''); setSearchResults([]);
  };

  const removeMember = (memberId) => setSelectedMembers(selectedMembers.filter(m => m.id !== memberId));
  const resetTeamModal = () => { setTeamName(''); setSearchQuery(''); setSearchResults([]); setSelectedMembers([]); setTeamError(null); };

  const closeCreateProject = () => {
    setShowCreateProject(false); setNewProjectMembers([]); setNewProjectSearch('');
    setNewProjectSearchResults([]); setCreateProjectError(null);
  };

  const handleCreateProject = async () => {
    setIsCreatingProject(true); setCreateProjectError(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/projects/custom`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProject.name, description: newProject.description, minTeam: parseInt(newProject.minTeam), maxTeam: parseInt(newProject.maxTeam), deadline: newProject.deadline || null, memberIds: newProjectMembers.map(m => m.id) })
      });
      const data = await r.json();
      if (!r.ok) { setCreateProjectError(data.error || 'Failed to create project.'); return; }
      await fetchCustomProjects(); await fetchMyTeams(); await fetchPendingInvites();
      closeCreateProject();
      setNewProject({ name: '', description: '', minTeam: 1, maxTeam: 1, deadline: '' });
      if (parseInt(newProject.minTeam) === 1 && parseInt(newProject.maxTeam) === 1 && newProjectMembers.length === 0) {
        navigate(`/kanban/${data.project.slug}`);
      }
    } catch (err) { setCreateProjectError('Network error. Please try again.'); }
    finally { setIsCreatingProject(false); }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const token = getToken();

      const freshResp = await fetch(`${API_URL}/projects/my-custom`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const freshProjects = freshResp.ok ? await freshResp.json() : [];
      const freshProject = freshProjects.find(p => p.id === projectToDelete.id) || projectToDelete;

      const projectTeam = freshProject.teams?.[0];

      if (!projectTeam) {
        const r = await fetch(`${API_URL}/projects/custom/${projectToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (r.ok) {
          await fetchCustomProjects();
          await fetchMyTeams();
          setShowDeleteProject(false);
          setProjectToDelete(null);
        } else {
          const data = await r.json().catch(() => ({}));
          addToast('Error', data.error || 'Failed to delete project. Please try again.');
        }
        return;
      }

      const approvedOtherMembers = projectTeam.members?.filter(
        m => m.userId !== currentUserId && m.status === 'approved'
      ) || [];

      if (approvedOtherMembers.length === 0) {
        const r = await fetch(`${API_URL}/projects/custom/${projectToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (r.ok) {
          await fetchCustomProjects();
          await fetchMyTeams();
          setShowDeleteProject(false);
          setProjectToDelete(null);
        } else {
          const data = await r.json().catch(() => ({}));
          addToast('Error', data.error || 'Failed to delete project. Please try again.');
        }
      } else {
        const r = await fetch(`${API_URL}/teams/${projectTeam.id}/request-delete`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (r.ok) {
          await fetchMyTeams();
          await fetchDeleteRequests();
          setShowDeleteProject(false);
          setProjectToDelete(null);
          addToast('Delete Request Sent', 'All team members must approve the deletion.');
        } else {
          const data = await r.json().catch(() => ({}));
          addToast('Error', data.error || 'Failed to send delete request. Please try again.');
        }
      }
    } catch (err) {
      console.error('Failed to delete project');
      addToast('Error', 'Network error. Please try again.');
    }
  };

  const confirmRemoveTeamMember = async () => {
    if (!memberToRemove || !teamForMemberRemoval) return;
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/teams/${teamForMemberRemoval.id}/members/${memberToRemove.userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) { await fetchMyTeams(); await fetchCustomProjects(); await fetchPendingInvites(); }
    } catch (err) { console.error('Failed to remove team member'); }
    setShowRemoveMember(false); setMemberToRemove(null); setTeamForMemberRemoval(null);
  };

  const minMembers = (selectedProject?.minTeam || 2) - 1;
  const maxMembers = (selectedProject?.maxTeam || selectedProject?.minTeam || 2) - 1;
  const canCreateTeam = (selectedProject?.isUserCreated || teamName.trim() !== '') && selectedMembers.length >= minMembers;

  const getCurriculumProjects = useMemo(() => {
    if (allProjects.length === 0) return {};
    const projectsByCircle = {};
    const userCurriculum = curriculum === 'unknown' ? 'old' : curriculum;
    allProjects.forEach(project => {
      if (project.isOuterCore) return;
      if (project.curricula.includes(userCurriculum)) {
        if (!projectsByCircle[project.circle]) projectsByCircle[project.circle] = [];
        projectsByCircle[project.circle].push({ slug: project.slug, name: project.name, team: project.minTeam, minTeam: project.minTeam, maxTeam: project.maxTeam });
      }
    });
    return projectsByCircle;
  }, [allProjects, curriculum]);

  const getUserProjectStatus = useCallback((projectSlug) => {
    const normalized = projectSlug.toLowerCase().replace(/_/g, '-');
    const project = userProjects.find(p => (p.project?.slug || '').toLowerCase().replace(/_/g, '-') === normalized);
    if (!project) return null;
    return { status: project.status, validated: project['validated?'], finalMark: project.final_mark, id: project.id };
  }, [userProjects]);

  const getCircleProjects = useCallback((circleNum) => {
    return (getCurriculumProjects[circleNum] || []).map(proj => ({ ...proj, userStatus: getUserProjectStatus(proj.slug) }));
  }, [getCurriculumProjects, getUserProjectStatus]);

  const needsCurriculumDetection = curriculum === 'unknown' && currentCircle >= 1;
  const activeCircle = selectedCircle !== null ? selectedCircle : currentCircle;
  const circleProjects = useMemo(() => getCircleProjects(activeCircle), [activeCircle, getCircleProjects]);

  const getCircleStats = useCallback((circleNum) => {
    const projects = getCircleProjects(circleNum);
    return { total: projects.length, completed: projects.filter(p => p.userStatus?.status === 'finished' && p.userStatus?.validated).length };
  }, [getCircleProjects]);

  const isExcludedOC = (slug) => { const s = slug.toLowerCase(); return s.includes('exam-rank') || s.includes('work-experience') || s.startsWith('42cursus-'); };

  const outerCoreProjects = useMemo(() => {
    if (!isTranscender) return [];
    const dbOC = allProjects.filter(p => p.isOuterCore && !isExcludedOC(p.slug)).map(p => ({ slug: p.slug, name: p.name, team: p.minTeam, minTeam: p.minTeam, maxTeam: p.maxTeam, userStatus: getUserProjectStatus(p.slug) })).filter(p => p.userStatus);
    const userOC = userProjects.filter(p => p.project?.isOuterCore && !isExcludedOC(p.project.slug)).map(p => ({ slug: p.project.slug, name: p.project.name, team: 1, minTeam: 1, maxTeam: 1, userStatus: { status: p.status, validated: p['validated?'], finalMark: p.final_mark, id: p.id } }));
    const all = [...dbOC];
    userOC.forEach(u => { if (!all.find(p => p.slug?.toLowerCase() === u.slug?.toLowerCase())) all.push(u); });
    return all;
  }, [isTranscender, allProjects, userProjects, getUserProjectStatus]);

  const hasIncomingPendingInvite = useCallback((projectSlug) => pendingInvites.some(i => i.project?.slug === projectSlug && i.myStatus === 'pending'), [pendingInvites]);

  const handleProjectClick = (project) => {
    if (hasIncomingPendingInvite(project.slug)) return;
    if (project.team > 1 || project.minTeam > 1) {
      const existing = myTeams.find(t => t.project.slug === project.slug && t.status === 'approved');
      if (existing) { navigate(`/kanban/${project.slug}`); return; }
      const pending = myTeams.find(t => t.project.slug === project.slug && t.status === 'pending');
      if (pending) return;
      setSelectedProject(project); setShowCreateTeam(true);
    } else { navigate(`/kanban/${project.slug}`); }
  };

  const handleTeamCreated = async () => {
    if (!canCreateTeam) return;
    setIsCreatingTeam(true); setTeamError(null);
    try {
      const token = getToken();
      let r;
      if (selectedProject.isUserCreated) {
        r = await fetch(`${API_URL}/teams/invite`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ projectSlug: selectedProject.slug, memberIds: selectedMembers.map(m => m.id) }) });
      } else {
        r = await fetch(`${API_URL}/teams`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: teamName, projectSlug: selectedProject.slug, memberIds: selectedMembers.map(m => m.id) }) });
      }
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Failed to create team');
      await fetchMyTeams(); await fetchPendingInvites(); await fetchCustomProjects();
      setShowCreateTeam(false); resetTeamModal();
    } catch (err) { setTeamError(err.message || 'Failed to create team'); }
    finally { setIsCreatingTeam(false); }
  };

  const handleInviteResponse = async (team, accept) => {
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/teams/${team._id || team.id}/respond`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept })
      });
      if (r.ok) {
        await fetchPendingInvites();
        await fetchMyTeams();
        await fetchCustomProjects();
      } else if (r.status === 404) {
        // Team no longer exists — refresh and clear stale invite
        await fetchPendingInvites();
        await fetchMyTeams();
        await fetchCustomProjects();
        addToast('Invite Expired', 'This team invite is no longer valid.');
      } else {
        const data = await r.json().catch(() => ({}));
        addToast('Error', data.error || 'Failed to respond to invite. Please try again.');
        await fetchPendingInvites();
      }
    } catch (err) {
      console.error('Failed to respond to invite');
      addToast('Error', 'Network error. Please try again.');
    }
  };

  const handleDeleteTeam = (team, e) => { e.stopPropagation(); setTeamToDelete(team); setShowDeleteConfirm(true); };

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    try { const token = getToken(); const r = await fetch(`${API_URL}/teams/${teamToDelete._id || teamToDelete.id}/request-delete`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }); if (r.ok) { await fetchMyTeams(); await fetchDeleteRequests(); setShowDeleteConfirm(false); setTeamToDelete(null); } }
    catch (err) { console.error('Failed to request team deletion'); }
  };

  const handleDeleteRequestResponse = async (request, accept) => {
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/teams/delete-requests/${request._id || request.id}/respond`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept })
      });
      if (r.ok) {
        await fetchDeleteRequests();
        await fetchMyTeams();
        await fetchCustomProjects();
      } else if (r.status === 404) {
        await fetchDeleteRequests();
        await fetchMyTeams();
        await fetchCustomProjects();
        addToast('Request Expired', 'This delete request is no longer valid.');
      } else {
        const data = await r.json().catch(() => ({}));
        addToast('Error', data.error || 'Failed to respond to delete request.');
        await fetchDeleteRequests();
      }
    } catch (err) {
      console.error('Failed to respond to delete request');
      addToast('Error', 'Network error. Please try again.');
    }
  };

  const goToTeamKanban = (team) => navigate(`/kanban/${team.project.slug}`);
  const closeModal = () => { setSelectedProject(null); setShowCreateTeam(false); resetTeamModal(); };

  const getStatusBadge = (userStatus) => {
    if (!userStatus) return { className: 'badge-not-started', text: 'Not Started' };
    if (userStatus.status === 'finished' && userStatus.validated) return { className: 'badge-completed', text: `${userStatus.finalMark}%` };
    if (userStatus.status === 'finished' && !userStatus.validated) return { className: 'badge-failed', text: 'Failed' };
    if (userStatus.status === 'in_progress') return { className: 'badge-active', text: 'In Progress' };
    if (userStatus.status === 'searching_a_group') return { className: 'badge-searching', text: 'Finding Team' };
    return { className: 'badge-active', text: userStatus.status };
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const validDeleteRequests = useMemo(() => deleteRequests.filter(req => req.requestedBy?.login && req.teamName), [deleteRequests]);
  const actionableInvitesCount = pendingInvites.filter(i => i.myStatus === 'pending').length;
  const actionableDeleteCount = validDeleteRequests.filter(r => r.myStatus === 'pending').length;
  const totalRequestsCount = pendingInvites.length + validDeleteRequests.length;
  const actionableCount = actionableInvitesCount + actionableDeleteCount;
  const pendingFriendCount = pendingFriendRequests.incoming?.length || 0;
  const totalActive = is42User
    ? isCadet
      ? getCircleProjects(currentCircle).filter(p => !p.userStatus?.validated).length
      : outerCoreProjects.filter(p => p.userStatus && !p.userStatus.validated).length
    : 0;
  const totalCompleted = userProjects.filter(p => p.status === 'finished' && p['validated?']).length;

  const titles = ["the Legendary", "the Mighty", "the Architect", "the Unstoppable", "the Bug Slayer", "the Chosen One", "the Code Wizard"];
  const randomTitle = useMemo(() => titles[Math.floor(Math.random() * titles.length)], []);
  const displayedFriends = friendSearch ? friendSearchResults : friends;
  const hasTeams = myTeams.filter(t => (t.status === 'approved' || t.isPending) && !t.project?.isUserCreated).length > 0;

  return (
    <div className="full-dashboard">

      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div className="logo-icon">21</div>
        <div className="logo-text">Project Hub</div>
      </div>

      <Sidebar
        user={user}
        activeView={activeView}
        onNavClick={handleNavClick}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        totalRequestsCount={totalRequestsCount}
        actionableCount={actionableCount}
        pendingFriendCount={pendingFriendCount}
        unreadChatCount={unreadChatCount}
        onShowInvites={() => setShowInvites(true)}
        onShowProfile={() => setShowProfile(true)}
        onLogout={handleLogout}
      />

      <main
        className={`main ${activeView === 'chat' ? 'p-0 overflow-hidden' : ''}`}
        style={activeView === 'chat' ? { padding: 0, overflow: 'hidden' } : {}}
      >
        {/* ── CHAT : always mounted so WS stays alive for notifications ── */}
        <div className={`chat-overlay${activeView === 'chat' ? '' : ' chat-hidden'}`}>
          <ChatPage
            apiBaseUrl={import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000'}
            integrated={true}
            isVisible={activeView === 'chat'}
            onMenuOpen={() => setSidebarOpen(true)}
          />
        </div>

        {activeView === 'dashboard' && (
          <>
            <div className="header">
              <div>
                <h1>{user?.nickname || username}, {randomTitle}</h1>
                <p>Here's what's happening with your projects</p>
              </div>
              <div className="header-actions">
                {is42User && (
                  <span className="curriculum-badge">{curriculum === 'old' ? 'C/C++' : curriculum === 'new' ? 'Python' : 'Detecting...'}</span>
                )}
                {!is42User && (
                  <button className="btn-primary" onClick={() => setShowCreateProject(true)} style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '10px' }}>+ New Project</button>
                )}
                <button className="legal-trigger" onClick={() => setShowLegal(true)} title="Legal">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </button>
              </div>
            </div>

            <div className={`stats ${!is42User ? 'stats-compact' : ''}`}>
              <div className="stat-card"><div className="stat-value">{is42User ? totalActive : customProjects.length}</div><div className="stat-label">{is42User ? 'Active' : 'Projects'}</div></div>
              <div className="stat-card"><div className="stat-value">{is42User ? totalCompleted : friends.length}</div><div className="stat-label">{is42User ? 'Completed' : 'Friends'}</div></div>
              {is42User && (
                <>
                  <div className="stat-card"><div className="stat-value">{wallet}</div><div className="stat-label">Wallet</div></div>
                  <div className="stat-card"><div className="stat-value">{correctionPoints}</div><div className="stat-label">Eval Points</div></div>
                </>
              )}
            </div>

            <div className={`info-card ${!is42User ? 'info-card-enhanced' : ''}`}><div className="info-grid">
              {is42User ? (
                <>
                  <div className="info-item"><div className="info-label">Level</div><div className="info-value">{level.toFixed(2)}</div></div>
                  <div className="info-item"><div className="info-label">Campus</div><div className="info-value">{campus}</div></div>
                  <div className="info-item"><div className="info-label">Grade</div><div className="info-value">{grade}</div></div>
                  <div className="info-item"><div className="info-label">Milestone</div><div className="info-value">{currentCircle}</div></div>
                </>
              ) : (
                <>
                  <div className="info-item"><div className="info-label">Email</div><div className="info-value">{user?.email || '—'}</div></div>
                  <div className="info-item"><div className="info-label">Member Since</div><div className="info-value">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</div></div>
                  {user?.bio && <div className="info-item" style={{ gridColumn: '1 / -1' }}><div className="info-label">Bio</div><div className="info-value">{user.bio}</div></div>}
                </>
              )}
            </div></div>

            {is42User && isCadet && (
              <>
                <div className="section-header"><h2>Milestones</h2></div>
                <div className="circle-selector">
                  {[0,1,2,3,4,5,6].map(m => {
                    const stats = getCircleStats(m);
                    const isLocked = curriculum === 'unknown' && m > 1;
                    return (
                      <button key={m} className={`circle-btn ${m === activeCircle ? 'active' : ''} ${m === currentCircle ? 'current' : ''} ${m < currentCircle ? 'complete' : ''} ${isLocked ? 'locked' : ''}`}
                        onClick={() => !isLocked && setSelectedCircle(m)} disabled={isLocked}>
                        <span className="circle-number">{m}</span>
                        {!isLocked && <span className="circle-progress">{stats.completed}/{stats.total}</span>}
                      </button>
                    );
                  })}
                </div>
                {needsCurriculumDetection && activeCircle === 1 && (
                  <div className="curriculum-notice"><p>Register for <strong>Born2beroot</strong> or <strong>push_swap</strong> on the intranet to unlock your curriculum path.</p></div>
                )}
                <div className="section-header"><h2>Milestone {activeCircle} Projects</h2></div>
                <div className="projects-grid">
                  {projectsLoading ? <div className="projects-loading-inline">Loading projects…</div> : circleProjects.map((project, idx) => {
                    const badge = getStatusBadge(project.userStatus);
                    const activeTeam = myTeams.find(t => t.project.slug === project.slug && t.status === 'approved');
                    const pendingTeam = myTeams.find(t => t.project.slug === project.slug && t.status === 'pending');
                    const hasPendingTeam = !!pendingTeam;
                    const hasPendingInvite = hasIncomingPendingInvite(project.slug);
                    const isBlocked = hasPendingTeam || hasPendingInvite;
                    return (
                      <div key={idx} className={`project-card ${activeTeam ? 'has-team' : ''} ${isBlocked ? 'pending-team' : ''}`} onClick={() => !activeTeam && !isBlocked && handleProjectClick(project)}>
                        <div className="project-header">
                          <div className="project-icon">{project.name.substring(0, 2).toUpperCase()}</div>
                          <span className={`project-badge ${activeTeam ? 'badge-completed' : isBlocked ? 'badge-pending' : badge.className}`}>
                            {activeTeam ? 'Active Team' : hasPendingTeam ? `Pending (${pendingTeam.acceptanceCount}/${pendingTeam.totalMembers})` : hasPendingInvite ? 'Invite Pending' : badge.text}
                          </span>
                        </div>
                        <div className="project-name">{project.name}</div>
                        <div className="project-meta">{project.team > 1 || project.minTeam > 1 ? 'Team' : 'Solo'}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {(!is42User || customProjects.length > 0) && (
              <>
                <div className="section-header">
                  <h2>My Projects</h2>
                </div>
                {customProjects.length === 0 ? (
                  <div className="quick-start-empty" onClick={() => setShowCreateProject(true)}>
                    <div className="quick-start-icon">+</div>
                    <h3>Create your first project</h3>
                    <p>Start a solo project or invite collaborators to work together.</p>
                  </div>
                ) : (
                  <div className="projects-grid">
                    {customProjects.map((project) => {
                      const projectTeam = project.teams?.[0];
                      const activeTeam = myTeams.find(t => t.project?.slug === project.slug && t.status === 'approved');
                      const pendingTeam = myTeams.find(t => t.project?.slug === project.slug && t.status === 'pending');
                      const hasPendingInvite = hasIncomingPendingInvite(project.slug);
                      const isTeamProject = project.maxTeam > 1;
                      const isCreator = parseInt(project.createdById) === parseInt(currentUserId);
                      const otherMembers = projectTeam?.members?.filter(m => m.userId !== currentUserId) || [];
                      const canInviteMore = isCreator && isTeamProject && otherMembers.length < project.maxTeam - 1;
                      const isBlockedForNonCreator = hasPendingInvite && !isCreator;
                      const pendingDeleteTeam = myTeams.find(t => t.project?.slug === project.slug && t.deleteRequest);
                      const hasPendingDelete = !!pendingDeleteTeam;

                      let statusDot = '';
                      if (activeTeam) statusDot = 'active';
                      else if (pendingTeam || (otherMembers.some(m => m.status === 'pending'))) statusDot = 'pending';

                      const handleCardClick = () => {
                        if (isBlockedForNonCreator) return;
                        navigate(`/kanban/${project.slug}`);
                      };

                      const handleInviteClick = (e) => {
                        e.stopPropagation();
                        setSelectedProject({
                          slug: project.slug,
                          name: project.name,
                          minTeam: project.minTeam,
                          maxTeam: project.maxTeam,
                          team: project.maxTeam,
                          isUserCreated: true
                        });
                        setShowCreateTeam(true);
                      };

                      const approvedCount = otherMembers.filter(m => m.status === 'approved').length + 1;

                      return (
                        <div
                          key={project.id}
                          className={`cpc-card${isBlockedForNonCreator ? ' cpc-blocked' : ''}${hasPendingDelete ? ' cpc-fading' : ''}`}
                          onClick={handleCardClick}
                        >
                          <div className="cpc-top">
                            <div className="cpc-icon">{project.name.substring(0, 2).toUpperCase()}</div>
                            <div className="cpc-title-row">
                              <div className="cpc-name">{project.name}</div>
                              <div className="cpc-subtitle">
                                {isTeamProject
                                  ? `${project.minTeam}–${project.maxTeam} members`
                                  : 'Solo'}
                                {!isCreator && project.createdBy ? ` · @${project.createdBy.login}` : ''}
                              </div>
                            </div>
                            <div className="cpc-actions-top">
                              {statusDot && <div className={`cpc-status-dot ${statusDot}`} title={statusDot} />}
                              {isCreator && (
                                <button
                                  className={`cpc-delete-btn${hasPendingDelete ? ' cpc-delete-disabled' : ''}`}
                                  disabled={hasPendingDelete}
                                  onClick={e => { e.stopPropagation(); if (!hasPendingDelete) { setProjectToDelete(project); setShowDeleteProject(true); } }}
                                  title={hasPendingDelete ? 'Delete request already pending' : 'Delete project'}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>

                          {project.description && (
                            <p className="cpc-desc">{project.description}</p>
                          )}

                          {project.deadline && (
                            <div className="cpc-deadline">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                              </svg>
                              Due {new Date(project.deadline).toLocaleDateString()}
                            </div>
                          )}

                          {otherMembers.length > 0 && (
                            <div className="cpc-members" onClick={e => e.stopPropagation()}>
                              {otherMembers.map(member => {
                                const approvedAfterRemoval = approvedCount - (member.status === 'approved' ? 1 : 0);
                                const canRemoveThis = approvedAfterRemoval >= project.minTeam;
                                return (
                                  <div key={member.userId} className="cpc-member-row">
                                    {member.user?.customAvatar || member.user?.avatar
                                      ? <img src={member.user.customAvatar || member.user.avatar} alt={member.user?.login} className="cpc-member-avatar" />
                                      : <div className="cpc-member-placeholder">{(member.user?.login || '?').slice(0, 2).toUpperCase()}</div>
                                    }
                                    <span className="cpc-member-name">
                                      {member.user?.nickname || member.user?.login}
                                    </span>
                                    <span className={`cpc-member-status ${member.status || 'pending'}`}>
                                      {member.status === 'approved' ? 'accepted' : 'pending'}
                                    </span>
                                    {isCreator && canRemoveThis && (
                                      <button
                                        className="cpc-remove-btn"
                                        title="Remove member"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setMemberToRemove(member);
                                          setTeamForMemberRemoval(projectTeam);
                                          setShowRemoveMember(true);
                                        }}
                                      >×</button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {(isBlockedForNonCreator || hasPendingDelete || canInviteMore) && (
                            <div className="cpc-footer">
                              {isBlockedForNonCreator ? (
                                <span className="cpc-blocked-notice">Invite pending — check Requests</span>
                              ) : hasPendingDelete ? (
                                <span className="cpc-blocked-notice cpc-delete-notice">Delete pending — waiting for members</span>
                              ) : canInviteMore ? (
                                <button className="cpc-invite-btn" onClick={handleInviteClick}>+ Invite member</button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {(is42User) && (
              <>
                <div className="section-header"><h2>My Teams</h2></div>
                {!hasTeams ? (
                  <div className="empty-teams"><p>No active teams yet. Create a team by clicking on a team project above.</p></div>
                ) : (
                  <div className="teams-grid">
                    {myTeams.filter(t => (t.status === 'approved' || t.isPending) && !t.project?.isUserCreated).map(team => {
                      const isPendingDelete = !!(team.deleteRequest && team.deleteRequest.requestedBy);
                      const isPendingAcceptance = team.isPending && !isPendingDelete;
                      return (
                        <div key={team._id || team.id} className={`team-card ${isPendingDelete ? 'pending-delete' : ''} ${isPendingAcceptance ? 'pending-acceptance' : ''}`} onClick={() => !isPendingDelete && !isPendingAcceptance && goToTeamKanban(team)}>
                          {isPendingDelete && <div className="pending-badge">@{team.deleteRequest.requestedByLogin}</div>}
                          {isPendingAcceptance && <div className="pending-badge acceptance">{team.acceptanceCount}/{team.totalMembers} accepted</div>}
                          <div className="team-header">
                            <div className="team-avatars">
                              {team.members.slice(0, 3).map((m, i) => m.avatar || m.user?.avatar
                                ? <img key={i} src={m.customAvatar || m.avatar || m.user?.customAvatar || m.user?.avatar} alt={m.login || m.user?.login} className="team-header-avatar" />
                                : <div key={i} className="team-header-placeholder">{(m.login || m.user?.login || '?').slice(0, 2).toUpperCase()}</div>)}
                            </div>
                            <div className="team-info"><div className="team-name">{team.name}</div><div className="team-project">{team.project.name}</div></div>
                            {!isPendingDelete && !isPendingAcceptance && (
                              <button className="team-delete" onClick={(e) => handleDeleteTeam(team, e)} title="Delete team">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {isTranscender && (
              <>
                <div className="section-header"><h2>Core Selection</h2></div>
                <div className="core-selector">
                  <button className={`core-btn ${activeSection === 'cc' ? 'active' : ''}`} onClick={() => setActiveSection('cc')}><span className="core-label">CC</span><span className="core-sublabel">Common Core</span></button>
                  <button className={`core-btn ${activeSection === 'oc' ? 'active' : ''}`} onClick={() => setActiveSection('oc')}><span className="core-label">OC</span><span className="core-sublabel">Outer Core</span></button>
                </div>
                {activeSection === 'cc' && (
                  <div className="cc-congrats-section"><div className="congrats-card">
                    <div className="congrats-icon"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
                    <h2>Congratulations {username}</h2>
                    <p className="congrats-main">you survived being a slave to the Black Hole.</p>
                    <p className="congrats-sub">The Common Core couldn't break you. Now go touch some grass before diving into the Outer Core... or don't, we're not your parents.</p>
                    <div className="congrats-stats">
                      <div className="congrats-stat"><span className="stat-number">∞</span><span className="stat-label">Debugging Hours</span></div>
                      <div className="congrats-stat"><span className="stat-number">42</span><span className="stat-label">Coffees Consumed</span></div>
                      <div className="congrats-stat"><span className="stat-number">{totalCompleted}</span><span className="stat-label">Projects Conquered</span></div>
                    </div>
                  </div></div>
                )}
                {activeSection === 'oc' && (
                  <>
                    <div className="section-header"><h2>Outer Core Projects</h2></div>
                    {outerCoreProjects.length > 0 ? (
                      <div className="projects-grid">{outerCoreProjects.map((project, idx) => {
                        const badge = getStatusBadge(project.userStatus);
                        const activeTeam = myTeams.find(t => t.project.slug === project.slug && t.status === 'approved');
                        const pendingTeam = myTeams.find(t => t.project.slug === project.slug && t.status === 'pending');
                        const hasPendingTeam = !!pendingTeam;
                        const hasPendingInvite = hasIncomingPendingInvite(project.slug);
                        const isBlocked = hasPendingTeam || hasPendingInvite;
                        return (
                          <div key={idx} className={`project-card ${activeTeam ? 'has-team' : ''} ${isBlocked ? 'pending-team' : ''}`} onClick={() => !activeTeam && !isBlocked && handleProjectClick(project)}>
                            <div className="project-header">
                              <div className="project-icon">{project.name.substring(0, 2).toUpperCase()}</div>
                              <span className={`project-badge ${activeTeam ? 'badge-completed' : isBlocked ? 'badge-pending' : badge.className}`}>
                                {activeTeam ? 'Active Team' : hasPendingTeam ? `Pending (${pendingTeam.acceptanceCount}/${pendingTeam.totalMembers})` : hasPendingInvite ? 'Invite Pending' : badge.text}
                              </span>
                            </div>
                            <div className="project-name">{project.name}</div>
                            <div className="project-meta">Outer Core</div>
                          </div>
                        );
                      })}</div>
                    ) : (
                      <div className="empty-state"><h3>No Outer Core Projects</h3><p>Register for projects on the intranet and they'll appear here automatically.</p></div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {activeView === 'friends' && (
          <>
            <div className="header"><div><h1>Friends</h1><p>{friends.length} friend{friends.length !== 1 ? 's' : ''}{pendingFriendCount > 0 ? ` · ${pendingFriendCount} pending` : ''}</p></div></div>
            <div className="friends-tabs">
              <button className={`friends-tab ${friendsTab === 'friends' ? 'active' : ''}`} onClick={() => setFriendsTab('friends')}>My Friends ({friends.length})</button>
              <button className={`friends-tab ${friendsTab === 'add' ? 'active' : ''}`} onClick={() => setFriendsTab('add')}>Add Friend</button>
              <button className={`friends-tab ${friendsTab === 'pending' ? 'active' : ''}`} onClick={() => setFriendsTab('pending')}>Pending {pendingFriendCount > 0 && <span className="tab-badge">{pendingFriendCount}</span>}</button>
            </div>

            {friendsTab === 'friends' && (
              <div className="friends-section">
                <div className="friends-search-bar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder="Search friends..." className="friends-search-input" value={friendSearch} onChange={(e) => { setFriendSearch(e.target.value); handleFriendSearch(e.target.value); }} />
                  {friendSearch && <button className="friends-search-clear" onClick={() => { setFriendSearch(''); setFriendSearchResults([]); }}>×</button>}
                </div>
                {displayedFriends.length > 0 ? (
                  <div className="friends-grid">
                    {displayedFriends.map(f => (
                      <div key={f.friendshipId} className="friend-card"><div className="friend-card-inner">
                        {f.effectiveAvatar ? <img src={f.effectiveAvatar} alt={f.login} className="friend-avatar" /> : <div className="friend-avatar-placeholder">{f.login?.slice(0, 2).toUpperCase()}</div>}
                        <div className="friend-details"><div className="friend-name">{f.nickname || f.displayName || f.login}</div><div className="friend-login">@{f.login}</div><div className="friend-meta">{f.campus} · Level {f.level?.toFixed(2)}</div></div>
                        <button className="friend-remove" onClick={() => handleRemoveFriendClick(f)} title="Remove friend"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div></div>
                    ))}
                  </div>
                ) : <div className="empty-state"><h3>{friendSearch ? 'No matches found' : 'No friends yet'}</h3><p>{friendSearch ? 'Try a different search' : 'Add friends using the "Add Friend" tab'}</p></div>}
              </div>
            )}

            {friendsTab === 'add' && (
              <div className="friends-section">
                <div className="friends-search-bar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder="Search users by login or nickname..." className="friends-search-input" value={addUserSearch} onChange={(e) => { setAddUserSearch(e.target.value); handleAddFriendSearch(e.target.value); }} />
                  {addUserSearch && <button className="friends-search-clear" onClick={() => { setAddUserSearch(''); setAddUserResults([]); }}>×</button>}
                </div>
                {addUserResults.length > 0 ? (
                  <div className="friends-grid">
                    {addUserResults.map(u => (
                      <div key={u.id} className="friend-card"><div className="friend-card-inner">
                        {u.effectiveAvatar ? <img src={u.effectiveAvatar} alt={u.login} className="friend-avatar" /> : <div className="friend-avatar-placeholder">{u.login?.slice(0, 2).toUpperCase()}</div>}
                        <div className="friend-details"><div className="friend-name">{u.nickname || u.displayName || u.login}</div><div className="friend-login">@{u.login}</div><div className="friend-meta">{u.campus} · Level {u.level?.toFixed(2)}</div></div>
                        {u.friendStatus === 'none' && <button className="btn-friend-add" onClick={() => sendFriendRequest(u.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add</button>}
                        {u.friendStatus === 'sent' && <span className="friend-status-badge sent">Pending</span>}
                        {u.friendStatus === 'received' && <button className="btn-friend-add" onClick={() => respondToFriendRequest(u.friendshipId, true)}>Accept</button>}
                        {u.friendStatus === 'friends' && <span className="friend-status-badge friends">Friends</span>}
                      </div></div>
                    ))}
                  </div>
                ) : addUserSearch.length >= 2 && !addUserSearching ? <div className="empty-state"><h3>No users found</h3><p>Try a different search term</p></div>
                : !addUserSearch ? <div className="empty-state"><h3>Search for users</h3><p>Type at least 2 characters to search</p></div> : null}
              </div>
            )}

            {friendsTab === 'pending' && (
              <div className="friends-section">
                {pendingFriendRequests.incoming?.length > 0 && (
                  <><h3 className="friends-subsection-title">Incoming Requests</h3>
                  <div className="friends-grid">{pendingFriendRequests.incoming.map(r => (
                    <div key={r.friendshipId} className="friend-card"><div className="friend-card-inner">
                      {r.effectiveAvatar ? <img src={r.effectiveAvatar} alt={r.login} className="friend-avatar" /> : <div className="friend-avatar-placeholder">{r.login?.slice(0, 2).toUpperCase()}</div>}
                      <div className="friend-details"><div className="friend-name">{r.nickname || r.displayName || r.login}</div><div className="friend-login">@{r.login}</div><div className="friend-meta">{r.campus} · Level {r.level?.toFixed(2)}</div></div>
                      <div className="friend-actions"><button className="btn-accept" onClick={() => respondToFriendRequest(r.friendshipId, true)}>Accept</button><button className="btn-decline" onClick={() => respondToFriendRequest(r.friendshipId, false)}>Decline</button></div>
                    </div></div>
                  ))}</div></>
                )}
                {pendingFriendRequests.outgoing?.length > 0 && (
                  <><h3 className="friends-subsection-title" style={{marginTop: pendingFriendRequests.incoming?.length > 0 ? '24px' : 0}}>Sent Requests</h3>
                  <div className="friends-grid">{pendingFriendRequests.outgoing.map(r => (
                    <div key={r.friendshipId} className="friend-card"><div className="friend-card-inner">
                      {r.effectiveAvatar ? <img src={r.effectiveAvatar} alt={r.login} className="friend-avatar" /> : <div className="friend-avatar-placeholder">{r.login?.slice(0, 2).toUpperCase()}</div>}
                      <div className="friend-details"><div className="friend-name">{r.nickname || r.displayName || r.login}</div><div className="friend-login">@{r.login}</div></div>
                      <span className="friend-status-badge sent">Pending</span>
                    </div></div>
                  ))}</div></>
                )}
                {(pendingFriendRequests.incoming?.length === 0 && pendingFriendRequests.outgoing?.length === 0) && <div className="empty-state"><h3>No pending requests</h3><p>Friend requests you send or receive will appear here</p></div>}
              </div>
            )}
          </>
        )}
      </main>

      <div className="app-toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`app-toast ${t.exit ? 'app-toast-exit' : ''}`}
            style={t.onClick ? { cursor: 'pointer' } : {}}
            onClick={() => { if (t.onClick) { t.onClick(); setToasts(prev => prev.filter(x => x.id !== t.id)); } }}
          >
            <div className="app-toast-title">{t.title}</div>
            <div className="app-toast-body">{t.body}</div>
          </div>
        ))}
      </div>

      {showCreateProject && (
        <div className="modal-overlay" onClick={closeCreateProject}>
          <div className="create-project-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-header">
              <div className="cp-modal-title-group">
                <div className="cp-modal-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <h2 className="cp-modal-title">New Project</h2>
              </div>
              <button className="cp-modal-close" onClick={closeCreateProject}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="cp-modal-body">
              <div className="cp-field">
                <label className="cp-label">Project Name</label>
                <input
                  type="text"
                  className="cp-input"
                  placeholder="What are you building?"
                  value={newProject.name}
                  onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                  maxLength={60}
                />
              </div>

              <div className="cp-field">
                <label className="cp-label">Description <span className="cp-optional">optional</span></label>
                <textarea
                  className="cp-input cp-textarea"
                  placeholder="Brief description of your project..."
                  value={newProject.description}
                  onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
                  maxLength={300}
                  rows={3}
                />
              </div>

              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label">Min Team</label>
                  <div className="cp-stepper">
                    <button className="cp-step-btn" onClick={() => setNewProject(p => ({ ...p, minTeam: Math.max(1, p.minTeam - 1) }))}>−</button>
                    <span className="cp-step-value">{newProject.minTeam}</span>
                    <button className="cp-step-btn" onClick={() => setNewProject(p => ({ ...p, minTeam: p.minTeam + 1, maxTeam: Math.max(p.maxTeam, p.minTeam + 1) }))}>+</button>
                  </div>
                </div>
                <div className="cp-field">
                  <label className="cp-label">Max Team</label>
                  <div className="cp-stepper">
                    <button className="cp-step-btn" onClick={() => setNewProject(p => ({ ...p, maxTeam: Math.max(p.minTeam, p.maxTeam - 1) }))}>−</button>
                    <span className="cp-step-value">{newProject.maxTeam}</span>
                    <button className="cp-step-btn" onClick={() => setNewProject(p => ({ ...p, maxTeam: p.maxTeam + 1 }))}>+</button>
                  </div>
                </div>
                <div className="cp-field">
                  <label className="cp-label">Deadline <span className="cp-optional">optional</span></label>
                  <input
                    type="date"
                    className="cp-input cp-date"
                    value={newProject.deadline}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setNewProject(p => ({ ...p, deadline: e.target.value }))}
                  />
                </div>
              </div>

              {newProject.maxTeam > 1 && (
                <div className="cp-field">
                  <label className="cp-label">
                    Invite Members <span className="cp-optional">{newProjectMembers.length}/{newProject.maxTeam - 1} slots</span>
                  </label>
                  <div className="cp-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      className="cp-search-input"
                      placeholder="Search by login or nickname..."
                      value={newProjectSearch}
                      onChange={e => { setNewProjectSearch(e.target.value); searchNewProjectMembers(e.target.value); }}
                      disabled={newProjectMembers.length >= newProject.maxTeam - 1}
                    />
                  </div>
                  {newProjectSearchResults.filter(r => !newProjectMembers.find(m => m.id === r.id)).length > 0 && (
                    <div className="cp-search-results">
                      {newProjectSearchResults.filter(r => !newProjectMembers.find(m => m.id === r.id)).map(result => (
                        <div key={result.id} className="cp-search-item" onClick={() => {
                          if (newProjectMembers.length < newProject.maxTeam - 1) setNewProjectMembers(prev => [...prev, result]);
                          setNewProjectSearch(''); setNewProjectSearchResults([]);
                        }}>
                          {result.avatar
                            ? <img src={result.avatar} alt={result.login} className="cp-search-avatar" />
                            : <div className="cp-search-avatar-placeholder">{result.login.slice(0, 2).toUpperCase()}</div>}
                          <div className="cp-search-info">
                            <span className="cp-search-login">{result.login}</span>
                            <span className="cp-search-meta">{result.intraId ? `${result.campus} · Lv ${result.level?.toFixed(1)}` : 'Member'}</span>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                      ))}
                    </div>
                  )}
                  {newProjectMembers.length > 0 && (
                    <div className="cp-members">
                      {newProjectMembers.map(member => (
                        <div key={member.id} className="cp-member-chip">
                          {member.avatar
                            ? <img src={member.avatar} alt={member.login} className="cp-chip-avatar" />
                            : <div className="cp-chip-avatar-placeholder">{member.login.slice(0, 2).toUpperCase()}</div>}
                          <span>{member.login}</span>
                          <button className="cp-chip-remove" onClick={() => setNewProjectMembers(prev => prev.filter(m => m.id !== member.id))}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {createProjectError && <div className="cp-error">{createProjectError}</div>}
            </div>

            <div className="cp-modal-footer">
              <button className="btn-secondary" onClick={closeCreateProject}>Cancel</button>
              <button
                className={`btn-primary ${!newProject.name.trim() || isCreatingProject ? 'btn-disabled' : ''}`}
                onClick={handleCreateProject}
                disabled={!newProject.name.trim() || isCreatingProject}
              >
                {isCreatingProject ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteProject && projectToDelete && (
        <div className="modal-overlay" onClick={() => { setShowDeleteProject(false); setProjectToDelete(null); }}>
          <div className="app-dialog app-dialog-confirm" onClick={e => e.stopPropagation()}>
            <div className="app-dialog-header"><h2>Delete Project?</h2><button className="modal-close" onClick={() => { setShowDeleteProject(false); setProjectToDelete(null); }}>×</button></div>
            <div className="app-dialog-body"><p>Are you sure you want to delete <strong>{projectToDelete.name}</strong>?</p><p>This will also delete the team and all members. This cannot be undone.</p></div>
            <div className="app-dialog-footer"><button className="btn-secondary" onClick={() => { setShowDeleteProject(false); setProjectToDelete(null); }}>Cancel</button><button className="btn-danger" onClick={handleDeleteProject}>Delete Project</button></div>
          </div>
        </div>
      )}

      {showRemoveMember && memberToRemove && (
        <div className="modal-overlay" onClick={() => { setShowRemoveMember(false); setMemberToRemove(null); setTeamForMemberRemoval(null); }}>
          <div className="app-dialog app-dialog-confirm" onClick={e => e.stopPropagation()}>
            <div className="app-dialog-header"><h2>Remove Member?</h2><button className="modal-close" onClick={() => { setShowRemoveMember(false); setMemberToRemove(null); setTeamForMemberRemoval(null); }}>×</button></div>
            <div className="app-dialog-body"><p>Remove <strong>@{memberToRemove.user?.login}</strong> from the team?</p><p>They will lose access to the project board and can be re-invited later.</p></div>
            <div className="app-dialog-footer"><button className="btn-secondary" onClick={() => { setShowRemoveMember(false); setMemberToRemove(null); setTeamForMemberRemoval(null); }}>Cancel</button><button className="btn-danger" onClick={confirmRemoveTeamMember}>Remove</button></div>
          </div>
        </div>
      )}

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUserUpdate={(data) => setFreshUser(prev => ({ ...prev, ...data }))}
        />
      )}

      {showDeleteFriendConfirm && friendToDelete && (
        <div className="modal-overlay" onClick={() => { setShowDeleteFriendConfirm(false); setFriendToDelete(null); }}>
          <div className="app-dialog app-dialog-confirm" onClick={e => e.stopPropagation()}>
            <div className="app-dialog-header"><h2>Remove Friend?</h2><button className="modal-close" onClick={() => { setShowDeleteFriendConfirm(false); setFriendToDelete(null); }}>×</button></div>
            <div className="app-dialog-body"><p>Are you sure you want to remove <strong>@{friendToDelete.login}</strong> from your friends?</p><p>You can always add them back later.</p></div>
            <div className="app-dialog-footer"><button className="btn-secondary" onClick={() => { setShowDeleteFriendConfirm(false); setFriendToDelete(null); }}>Cancel</button><button className="btn-danger" onClick={confirmRemoveFriend}>Remove</button></div>
          </div>
        </div>
      )}

      {showCreateTeam && selectedProject && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="app-dialog" onClick={e => e.stopPropagation()}>
            <div className="app-dialog-header"><h2>{selectedProject.isUserCreated ? 'Invite Members' : 'Create Team'}</h2><button className="modal-close" onClick={closeModal}>×</button></div>
            <div className="app-dialog-body">
              <p><strong>{selectedProject.name}</strong></p>
              <p>Team size: {selectedProject.minTeam}{selectedProject.maxTeam && selectedProject.maxTeam !== selectedProject.minTeam ? `-${selectedProject.maxTeam}` : ''} members (you + {minMembers}{maxMembers !== minMembers ? `-${maxMembers}` : ''} others)</p>
              <div className="team-form">
                {!selectedProject.isUserCreated && <input type="text" placeholder="Team name *" className={`team-input ${!teamName.trim() ? 'input-required' : ''}`} value={teamName} onChange={(e) => setTeamName(e.target.value)} />}
                <div className="search-container">
                  <input type="text" placeholder={selectedProject.isUserCreated ? 'Search any user by login or nickname...' : 'Search member by login...'} className="team-input" value={searchQuery} onChange={handleSearchChange} disabled={selectedMembers.length >= maxMembers} />
                  {searching && searchQuery.length > 0 && <div className="search-loading">Searching...</div>}
                  {selectedMembers.length >= maxMembers && <div className="max-members-reached">Maximum team members reached</div>}
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map(r => (
                        <div key={r.id} className="search-result-item" onClick={() => addMember(r)}>
                          {r.avatar ? <img src={r.avatar} alt={r.login} className="result-avatar" /> : <div className="result-avatar-placeholder">{r.login.slice(0, 2).toUpperCase()}</div>}
                          <div className="result-info"><span className="result-login">{r.login}</span><span className="result-details">{r.intraId ? `${r.campus} - Level ${r.level?.toFixed(2)}` : 'Member'}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="selected-members">
                  <p>Team Members: {selectedMembers.length}/{minMembers}{maxMembers !== minMembers ? `-${maxMembers}` : ''}</p>
                  {selectedMembers.length < minMembers && <div className="no-members">Add at least {minMembers} member{minMembers > 1 ? 's' : ''} to continue</div>}
                  {selectedMembers.map(m => (
                    <div key={m.id} className="selected-member">
                      {m.avatar ? <img src={m.avatar} alt={m.login} className="member-avatar" /> : <div className="member-avatar-placeholder">{m.login.slice(0, 2).toUpperCase()}</div>}
                      <span>{m.login}</span>
                      <button className="remove-member" onClick={() => removeMember(m.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              {teamError && <div className="profile-message error">{teamError}</div>}
            </div>
            <div className="app-dialog-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button className={`btn-primary ${!canCreateTeam || isCreatingTeam ? 'btn-disabled' : ''}`} onClick={handleTeamCreated} disabled={!canCreateTeam || isCreatingTeam}>{isCreatingTeam ? (selectedProject.isUserCreated ? 'Inviting...' : 'Creating...') : (selectedProject.isUserCreated ? 'Invite Members' : 'Create Team')}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && teamToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="app-dialog app-dialog-confirm" onClick={e => e.stopPropagation()}>
            <div className="app-dialog-header"><h2>Delete Team?</h2><button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button></div>
            <div className="app-dialog-body"><p>Are you sure you want to delete <strong>{teamToDelete.name}</strong>?</p><p>All team members will need to approve this deletion request.</p></div>
            <div className="app-dialog-footer"><button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button><button className="btn-danger" onClick={confirmDeleteTeam}>Request Delete</button></div>
          </div>
        </div>
      )}

      {showInvites && (
        <div className="modal-overlay" onClick={() => setShowInvites(false)}>
          <div className="app-dialog" onClick={e => e.stopPropagation()}>
            <div className="app-dialog-header"><h2>Team Requests</h2><button className="modal-close" onClick={() => setShowInvites(false)}>×</button></div>
            <div className="app-dialog-body">
              {pendingInvites.length === 0 && validDeleteRequests.length === 0 ? <p>No pending requests</p> : (
                <div className="requests-container">
                  {pendingInvites.length > 0 && (
                    <><h3 className="requests-section-title">Team Invitations</h3>
                    <div className="invites-list">
                      {pendingInvites.map(invite => {
                        const alreadyAccepted = invite.myStatus === 'approved';
                        return (
                          <div key={invite._id || invite.id} className={`invite-item ${alreadyAccepted ? 'responded' : ''}`}>
                            <div className="invite-info"><div className="invite-team-name">{invite.name}</div><div className="invite-project">{invite.project.name}</div><div className="invite-creator">by @{invite.creator?.login} ({invite.acceptanceCount || 0}/{invite.totalMembers || 0} accepted)</div></div>
                            <div className="invite-actions">{alreadyAccepted ? <span className="response-badge accepted">Accepted</span> : <><button className="btn-accept" onClick={() => handleInviteResponse(invite, true)}>Accept</button><button className="btn-decline" onClick={() => handleInviteResponse(invite, false)}>Decline</button></>}</div>
                          </div>
                        );
                      })}
                    </div></>
                  )}
                  {validDeleteRequests.length > 0 && (
                    <><h3 className="requests-section-title">Deletion Requests</h3>
                    <div className="invites-list">
                      {validDeleteRequests.map(request => {
                        const alreadyApproved = request.myStatus === 'approved';
                        const alreadyRejected = request.myStatus === 'rejected';
                        const alreadyResponded = alreadyApproved || alreadyRejected;
                        return (
                          <div key={request._id || request.id} className={`invite-item delete-request ${alreadyResponded ? 'responded' : ''}`}>
                            <div className="invite-info"><div className="invite-team-name">{request.teamName}</div><div className="invite-project">{request.project?.name}</div><div className="invite-creator">@{request.requestedBy?.login} wants to delete ({request.approvalCount}/{request.totalMembers} approved)</div></div>
                            <div className="invite-actions">{alreadyApproved ? <span className="response-badge accepted">Approved</span> : alreadyRejected ? <span className="response-badge declined">Rejected</span> : <><button className="btn-accept" onClick={() => handleDeleteRequestResponse(request, true)}>Approve</button><button className="btn-decline" onClick={() => handleDeleteRequestResponse(request, false)}>Reject</button></>}</div>
                          </div>
                        );
                      })}
                    </div></>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
    </div>
  );
};

export default FullDashboard;