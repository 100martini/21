const jwt = require('jsonwebtoken');

let io = null;
const projectRooms = {};
const editingCards = new Map();

function initSocket(server) {
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.login = decoded.login;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);
    console.log(`Socket connected: ${socket.login} (${userRoom})`);

    socket.on('join-project', (data) => {
      const projectId = data.projectId || data;
      const userName = data.userName || socket.login || 'User';

      socket.join(`project-${projectId}`);
      socket.projectId = projectId;
      socket.userName = userName;
      projectRooms[socket.id] = projectId;

      const editingCardsArray = Array.from(editingCards.entries()).map(([cardId, info]) => ({
        cardId,
        ...info
      }));
      socket.emit('editing-cards:sync', editingCardsArray);

      io.to(`project-${projectId}`).emit('user-joined', {
        userId: socket.id,
        userName,
        message: `${userName} joined`
      });
    });

    socket.on('card:editing', (data) => {
      const { cardId, userName } = data;
      const projectId = socket.projectId;

      editingCards.set(cardId, {
        userId: socket.id,
        userName: userName || socket.login,
        socketId: socket.id
      });

      io.to(`project-${projectId}`).emit('card:editing', {
        cardId,
        userId: socket.id,
        userName: userName || socket.login
      });
    });

    socket.on('card:editing:stop', (data) => {
      const { cardId } = data;
      const projectId = socket.projectId;

      editingCards.delete(cardId);

      io.to(`project-${projectId}`).emit('card:editing:stop', { cardId });
    });

    socket.on('task-updated', (data) => {
      const projectId = projectRooms[socket.id];
      io.to(`project-${projectId}`).emit('task-updated', data);
    });

    socket.on('task-created', (data) => {
      const projectId = projectRooms[socket.id];
      io.to(`project-${projectId}`).emit('task-created', data);
    });

    socket.on('task-deleted', (data) => {
      const projectId = projectRooms[socket.id];
      io.to(`project-${projectId}`).emit('task-deleted', data);
    });

    socket.on('task-moved', (data) => {
      const projectId = projectRooms[socket.id];
      io.to(`project-${projectId}`).emit('task-moved', data);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.login}`);

      const cardsToRelease = [];
      for (const [cardId, info] of editingCards.entries()) {
        if (info.socketId === socket.id) {
          cardsToRelease.push(cardId);
          editingCards.delete(cardId);
        }
      }

      if (cardsToRelease.length > 0 && socket.projectId) {
        io.to(`project-${socket.projectId}`).emit('cards:released', {
          cardIds: cardsToRelease,
          userId: socket.id
        });
      }

      delete projectRooms[socket.id];
    });
  });

  return io;
}

function getIO() {
  return io;
}

function notifyUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

function notifyUsers(userIds, event, data) {
  if (io) {
    userIds.forEach(id => {
      io.to(`user:${id}`).emit(event, data);
    });
  }
}

module.exports = { initSocket, getIO, notifyUser, notifyUsers };
