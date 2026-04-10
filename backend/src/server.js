require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

initSocket(server);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:8443',
  'https://127.0.0.1:8443'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);
  next();
});

const authRoutes = require('./routes/auth.routes');
const teamRoutes = require('./routes/team.routes');
const projectRoutes = require('./routes/project.routes');
const profileRoutes = require('./routes/profile.routes');
const friendRoutes = require('./routes/friend.routes');
const kanbanRoutes = require('./routes/kanban');

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/kanban', kanbanRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', database: 'PostgreSQL' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await prisma.$disconnect();
  process.exit(0);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
Server is running!
Port: ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}
API: http://localhost:${PORT}
WebSocket: ws://localhost:${PORT}
  `);
});

module.exports = { prisma };
