## Modules

> 14 points are required to complete the project.
> Each **Major** module is worth **2 pts**, each **Minor** is worth **1 pt**.

---

### 🌐 Web

| Type | Module | Points | Implementation |
|------|--------|:------:|----------------|
| **Major** | Framework for Frontend & Backend | 2 | React (Vite) frontend · Express.js backend |
| **Major** | Real-time features via WebSockets | 2 | Socket.io — live Kanban editing, team notifications, game sessions |
| **Major** | User interaction (chat, profiles, friends) | 2 | Full chat service (FastAPI + WebSockets), friend requests, user profiles |
| **Minor** | ORM for the database | 1 | Prisma — main backend + both game servers |
| **Minor** | Real-time collaborative features | 1 | Kanban board with live multi-user editing and per-card lock indicators |
| **Minor** | Notification system | 1 | Real-time notifications for team invites, friend requests, deletions via Socket.io |
| **Minor** | File upload & management | 1 | Chat attachment upload endpoint with type/size validation and secure storage |

**Subtotal: 10 pts**

---

### 👤 User Management

| Type | Module | Points | Implementation |
|------|--------|:------:|----------------|
| **Major** | Standard user management & authentication | 2 | Profile pages, custom avatars, nickname, bio, online status, friend system |
| **Minor** | OAuth 2.0 — 42 Intra | 1 | Login via 42 OAuth with automatic project/level/grade sync from the 42 API |
| **Minor** | Game statistics & match history | 1 | Per-user win/loss/draw tracking for both games, stored in PostgreSQL |

**Subtotal: 4 pts**

---

### 🎮 Gaming & User Experience

| Type | Module | Points | Implementation |
|------|--------|:------:|----------------|
| **Major** | Web-based multiplayer game | 2 | Tic-Tac-Toe — live rooms, local and online modes (React) |
| **Major** | Remote players | 2 | Both games support real-time remote play with graceful reconnection (15 s timeout) |
| **Major** | Second game with matchmaking | 2 | Checkers — distinct game, matchmaking queue, full match history |
| **Minor** | Spectator mode | 1 | Both games support spectators with real-time board updates |

**Subtotal: 7 pts**

---

### ⚙️ DevOps

| Type | Module | Points | Implementation |
|------|--------|:------:|----------------|
| **Major** | Backend as microservices | 2 | Separate services: `backend`, `checker-server`, `tictac-server`, `chat-backend` — each with its own database and single responsibility, communicating via REST and WebSockets |

**Subtotal: 2 pts**

---

### 📊 Point Summary

| Category | Points |
|----------|:------:|
| Web | 10 |
| User Management | 4 |
| Gaming & User Experience | 7 |
| DevOps | 2 |
| **Total** | **23** |
| Mandatory threshold | ✅ 14 |
| Bonus (capped at 5) | +5 |