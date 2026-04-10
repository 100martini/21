import { io } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

let socket = null;

export function connectSocket() {
  const token = getToken();
  if (!token) return null;

  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    reconnectionAttempts: 5
  });


  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export const joinProject = (data) => {
  if (socket) socket.emit('join-project', data);
};

export const emitCardEditing = (cardId, userName) => {
  if (socket) socket.emit('card:editing', { cardId, userName });
};

export const emitCardEditingStop = (cardId) => {
  if (socket) socket.emit('card:editing:stop', { cardId });
};

export const emitTaskUpdated = (data) => {
  if (socket) socket.emit('task-updated', data);
};

export const emitTaskCreated = (data) => {
  if (socket) socket.emit('task-created', data);
};

export const emitTaskDeleted = (data) => {
  if (socket) socket.emit('task-deleted', data);
};

export const emitTaskMoved = (data) => {
  if (socket) socket.emit('task-moved', data);
};