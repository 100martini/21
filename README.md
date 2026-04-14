# 21 - project hub 🃏

> a real-time collaboration platform for 42 students. login with your intra, chat with your team, manage tasks — and when you need a break, there's a game area waiting.

---

## features

**platform**
- login with 42 intra oauth 2.0 or email/password — your choice
- custom profiles with avatar, nickname, bio, and online status
- friend system with requests and direct messaging
- real-time notifications (invites, friend requests, game challenges)

**team workspace**
- real-time kanban board with live multi-user editing and per-card lock indicators
- team chat with channels, file attachments, and message history
- file upload with type/size validation

**games**
- tic-tac-toe — local and online multiplayer with live rooms
- checkers — matchmaking queue, full match history
- spectator mode for both games
- per-user stats: win/loss/draw tracking

---

## stack

| layer | tech |
|---|---|
| frontend | react + typescript + tailwindcss |
| main backend | express.js + socket.io |
| chat backend | fastapi + websockets |
| game servers | node.js (tictac-server, checker-server) |
| database | postgresql + prisma |
| infrastructure | docker compose + nginx |
| auth | 42 oauth 2.0 + jwt |

---

## architecture

microservices — each service has its own responsibility and database:

```
nginx (reverse proxy)
├── frontend          ← react/typescript SPA
├── backend           ← main api, auth, users, kanban, notifications
├── chat-backend      ← fastapi websocket chat service
├── tictac-server     ← tic-tac-toe game engine
└── checker-server    ← checkers game engine + matchmaking
```

services communicate via rest and websockets. docker compose orchestrates everything.

---

## run it

```bash
git clone <repo>
cp .env.example .env
# fill in your 42 oauth credentials and secrets
docker compose up --build
```

then open `https://localhost`

---

## project structure

```
.
├── docker-compose.yml
├── Makefile
├── README.md
└── src/
    ├── nginx/
    ├── frontend/          ← react + typescript
    ├── backend/           ← express.js + prisma
    ├── chat/
    │   ├── chat_back/     ← fastapi
    │   └── chat-front/    ← chat frontend
    ├── TictacServer/     ← tic-tac-toe
    └── CheckerServer/    ← checkers + matchmaking
```

---

made at **1337 benguerir** · 42 network  
`wel-kass` · [intra](https://profile.intra.42.fr/users/wel-kass)
