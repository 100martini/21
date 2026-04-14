import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_CHECKERS_SOCKET_URL || 'http://localhost:3001';

let socket = null;

// ─── Session Storage Helpers ─────────────────────────────────────────────────

const saveReconnectionData = (data) => {
    if (data) {
        sessionStorage.setItem('checkers_reconnect', JSON.stringify(data));
    }
};

const loadReconnectionData = () => {
    try {
        const data = sessionStorage.getItem('checkers_reconnect');
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Failed to load reconnection data:', e);
        return null;
    }
};

const clearReconnectionData = () => {
    sessionStorage.removeItem('checkers_reconnect');
};

// ─── Socket Management ────────────────────────────────────────────────────────

export const initSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: false,
            timeout: 20000
        });

        socket.on('disconnect', (reason) => {
            // console.log('Socket disconnected:', reason);
        });

        socket.on('connect_error', (error) => {
            // console.error('Connection error:', error.message);
        });
    }
    return socket;
};

export const getSocket = () => {
    if (!socket) {
        return initSocket();
    }
    return socket;
};

export const pauseSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const disconnectSocket = () => {
    if (socket) {
        clearReconnectionData();
        socket.disconnect();
        socket = null;
    }
};

// ─── Session API (used by component) ─────────────────────────────────────────

export const saveSession = (roomId, playerName, color) => {
    saveReconnectionData({ roomId, playerName, color });
};

export const clearSession = () => {
    clearReconnectionData();
};

export const getSavedSession = () => {
    return loadReconnectionData();
};