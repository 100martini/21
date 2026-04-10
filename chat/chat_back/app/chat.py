# app/chat.py
import json
import logging
import asyncio
import os
from typing import Dict, List
from datetime import datetime
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    status,
    UploadFile,
    File,
    Request,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.db import get_async_session, AsyncSessionLocal
from app.models import (
    User,
    Participant,
    Message,
    Conversation,
    MessageReaction,
    UserBlock,
    TeamConversationLink,
)
from app.utils.jwt import decode_jwt_token
from app.main_integration import (
    get_team_for_user_and_project,
    get_all_teams_for_user,
    search_intra_users,
    get_user_friends,
    get_user_login,
    get_user_avatar,
)

from app.crud import (
    persist_message,
    get_messages_for_conv,
    create_conversation,
    update_message,
    delete_message,
    mark_message_read,
    add_reaction,
    remove_reaction
)

logger = logging.getLogger("chat")
router = APIRouter()
security = HTTPBearer()

MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024


class ConnectionManager:
    def __init__(self):
        # conv
        self.active: Dict[int, List[WebSocket]] = {}
        self.ws_user: Dict[WebSocket, int] = {}  # ws -> user_id

    async def connect(self, conversation_id: int, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active.setdefault(conversation_id, []).append(websocket)
        self.ws_user[websocket] = user_id
        logger.info(f"WS connected conv={conversation_id} total={len(self.active[conversation_id])}")

    def get_online_user_ids(self, conversation_id: int) -> List[int]:
        return [self.ws_user[ws] for ws in self.active.get(conversation_id, []) if ws in self.ws_user]

    def get_all_online_user_ids(self) -> List[int]:
        return list(set(self.ws_user.values()))

    def disconnect(self, conversation_id: int, websocket: WebSocket):
        conns = self.active.get(conversation_id)
        if conns and websocket in conns:
            conns.remove(websocket)
        self.ws_user.pop(websocket, None)
        logger.info(f"WS disconnected conv={conversation_id}")

    async def broadcast(self, conversation_id: int, message: dict):
        conns = self.active.get(conversation_id, [])
        data = json.dumps(message)
        for ws in list(conns):
            try:
                await ws.send_text(data)
            except Exception:
                logger.exception("send failed, removing socket")
                self.disconnect(conversation_id, ws)

manager = ConnectionManager()


REDIS_CHANNEL = "chat:messages"

async def start_redis_listener(app):
    try:
        redis = app.state.redis
    except Exception:
        logger.info("No redis configured, skipping listener")
        return

    instance_id = app.state.instance_id
    try:
        pubsub = redis.pubsub()
        await pubsub.subscribe(REDIS_CHANNEL)
        logger.info("Subscribed to Redis channel %s", REDIS_CHANNEL)
        async for item in pubsub.listen():
            if item is None or item.get("type") != "message":
                continue
            try:
                payload = json.loads(item["data"])
            except Exception:
                continue
            origin = payload.get("origin")
            if origin == instance_id:
                # pass
                continue
            conversation_id = payload.get("conversation_id")
            message = payload.get("message")
            if conversation_id and message:
                await manager.broadcast(conversation_id, {"type":"message","message":message})
    except asyncio.CancelledError:
        logger.info("Redis listener cancelled")
    except RedisConnectionError:
        logger.info("Redis connection closed (shutdown)")
    except Exception:
        logger.exception("Redis listener error")

async def publish_message_to_redis(app, conversation_id: int, payload: dict):
    try:
        redis = app.state.redis
    except Exception:
        return
    try:
        envelope = {"origin": app.state.instance_id, "conversation_id": conversation_id, "message": payload}
        await redis.publish(REDIS_CHANNEL, json.dumps(envelope))
    except Exception:
        logger.exception("Failed to publish to redis")


async def resolve_chat_user(payload: dict, user_id: int, db: AsyncSession):
    """
    Resolve the actual chat DB user for a given JWT payload + main-backend user_id.
    Handles the case where the user registered via the standalone chat system and
    has a different DB id than their main-backend id.

    When an ID mismatch is detected, repairs any participant/message entries that
    were created using the main-backend ID so conversations are visible to this user.
    """
    from sqlalchemy import update as sa_update, delete as sa_delete

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()

    if not user:
        username = payload.get("login") or f"user_{user_id}"
        by_username = await db.execute(select(User).filter(User.username == username))
        found = by_username.scalars().first()

        if found:
            # User exists under a different (standalone) ID.
            # Fix any participant/message rows that were written with the main-backend ID
            # so this user can see conversations that were created for them.
            actual_id = found.id
            try:
                # Participants: if there is already a row for actual_id in the same conv,
                # delete the stale main-id row; otherwise remap it.
                stale_parts = (await db.execute(
                    select(Participant).where(Participant.user_id == user_id)
                )).scalars().all()
                for part in stale_parts:
                    dup = (await db.execute(
                        select(Participant).where(
                            Participant.conversation_id == part.conversation_id,
                            Participant.user_id == actual_id
                        )
                    )).scalars().first()
                    if dup:
                        await db.execute(sa_delete(Participant).where(Participant.id == part.id))
                    else:
                        await db.execute(
                            sa_update(Participant)
                            .where(Participant.id == part.id)
                            .values(user_id=actual_id)
                        )
                # Messages
                await db.execute(
                    sa_update(Message).where(Message.user_id == user_id).values(user_id=actual_id)
                )
                # Conversation creator
                await db.execute(
                    sa_update(Conversation).where(Conversation.created_by == user_id).values(created_by=actual_id)
                )
                await db.commit()
            except Exception:
                await db.rollback()
                logger.exception("resolve_chat_user: failed to repair ID mismatch entries")
            user = found

        else:
            try:
                user = User(id=user_id, username=username, is_active=True)
                db.add(user)
                await db.commit()
                await db.refresh(user)
            except Exception:
                await db.rollback()
                r2 = await db.execute(select(User).filter(User.id == user_id))
                user = r2.scalars().first()
                if not user:
                    r3 = await db.execute(select(User).filter(User.username == username))
                    user = r3.scalars().first()

    # Sync avatar from main DB on every auth (keep it fresh)
    if user:
        try:
            avatar_url = await get_user_avatar(user.id)
            if avatar_url and avatar_url != user.avatar:
                user.avatar = avatar_url
                await db.commit()
        except Exception:
            pass

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_async_session)
):
    token = credentials.credentials
    payload = decode_jwt_token(token)

    raw_user_id = (
        payload.get("sub")
        or payload.get("user_id")
        or payload.get("userId")
    )
    if not raw_user_id:
        raise HTTPException(status_code=401, detail="Token invalide")

    try:
        user_id = int(raw_user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Token invalide")

    user = await resolve_chat_user(payload, user_id, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unable to authenticate user")

    return user


@router.get("/me")
async def api_me(current_user = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}


@router.get("/online_users")
async def get_online_users(current_user = Depends(get_current_user)):
    return manager.get_all_online_user_ids()


@router.post("/upload")
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
):
    contents = await file.read()
    size = len(contents)
    if size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large (max 1MB).",
        )

    original_name = file.filename or "file"
    _, ext = os.path.splitext(original_name)
    safe_ext = ext if len(ext) <= 10 else ""
    unique_name = f"{uuid4().hex}{safe_ext}"

    upload_dir = getattr(request.app.state, "upload_dir", os.getenv("UPLOAD_DIR", "uploads"))
    os.makedirs(upload_dir, exist_ok=True)
    disk_path = os.path.join(upload_dir, unique_name)

    try:
        with open(disk_path, "wb") as f:
            f.write(contents)
    except Exception:
        logger.exception("Failed to write uploaded file")
        raise HTTPException(status_code=500, detail="Failed to store file.")

    # Build a public URL using the forwarded host (nginx sets Host header).
    # Nginx proxies /chat/ → chat-backend:8000/, so /chat/uploads/<file> resolves correctly.
    host = request.headers.get("host", "localhost:8443")
    proto = request.headers.get("x-forwarded-proto", "https")
    url = f"{proto}://{host}/chat/uploads/{unique_name}"

    return {
        "url": url,
        "filename": original_name,
        "size": size,
        "content_type": file.content_type or "application/octet-stream",
    }


@router.get("/conversations")
async def list_conversations(current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    q = select(Conversation).join(Participant, Participant.conversation_id == Conversation.id).filter(Participant.user_id == current_user.id)
    res = await db.execute(q)
    convs = res.scalars().all()
    
    out = []
    for c in convs:
        c_dict = {"id": c.id, "name": c.name, "is_group": c.is_group}
        if not c.is_group and not c.name:
            # autre
            pq = select(User.username).join(Participant, Participant.user_id == User.id).filter(
                Participant.conversation_id == c.id, 
                Participant.user_id != current_user.id
            )
            pres = await db.execute(pq)
            other_username = pres.scalars().first()
            if other_username:
                c_dict["name"] = other_username
        out.append(c_dict)
    return out


@router.get("/unread_count")
async def get_unread_count(current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Returns the total number of unread messages for the current user.
    A message is unread if:
    - It is in a conversation the user is a participant of
    - The user is NOT the sender
    - There is no MessageRead record for this user and message
    """
    from sqlalchemy import func, and_, not_, exists
    from app.models import MessageRead, Message, Participant

    
    subq = select(Participant.conversation_id).filter(Participant.user_id == current_user.id)
    
    q = select(func.count(Message.id)).filter(
        Message.conversation_id.in_(subq),
        Message.user_id != current_user.id,
        not_(exists().where(
            and_(
                MessageRead.message_id == Message.id,
                MessageRead.user_id == current_user.id
            )
        ))
    )
    
    res = await db.execute(q)
    unread_count = res.scalar() or 0
    return {"unread_count": unread_count}


@router.get("/search_users")
async def search_users(
    query: str,
    limit: int = 15,
    current_user = Depends(get_current_user)
):
    """
    Search for other users across the master intra database.
    """
    if not query or len(query.strip()) < 2:
        return []

    users = await search_intra_users(query.strip(), limit)
    # rsl
    return [u for u in users if u["id"] != current_user.id]


@router.get("/friends")
async def get_friends(current_user: User = Depends(get_current_user)):
    # appel depuis base
    friends = await get_user_friends(current_user.id)
    return friends


@router.post("/conversations/direct")
async def get_or_create_direct_conv(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):

    friend_main_id = payload.get("friend_id")
    if not friend_main_id:
        raise HTTPException(status_code=400, detail="friend_id manquant")
    friend_main_id = int(friend_main_id)

    # Resolve the friend's actual chat user ID (may differ from main backend ID)
    fq = await db.execute(select(User).filter(User.id == friend_main_id))
    chat_friend = fq.scalars().first()
    if not chat_friend:
        # Friend hasn't logged into chat yet — look up their login from the main DB
        friend_login = await get_user_login(friend_main_id)
        if friend_login:
            by_login = await db.execute(select(User).filter(User.username == friend_login))
            chat_friend = by_login.scalars().first()
        if not chat_friend and friend_login:
            # Pre-create the friend so they see the conversation when they first log in
            try:
                chat_friend = User(id=friend_main_id, username=friend_login, is_active=True)
                db.add(chat_friend)
                await db.commit()
                await db.refresh(chat_friend)
            except Exception:
                await db.rollback()
                r = await db.execute(select(User).filter(User.username == friend_login))
                chat_friend = r.scalars().first()
        if not chat_friend:
            raise HTTPException(status_code=404, detail="Friend not found in chat system")

    friend_id = chat_friend.id

    stmt1 = select(Participant.conversation_id).where(Participant.user_id == current_user.id)
    res1 = await db.execute(stmt1)
    c_ids1 = {r for r in res1.scalars().all()}

    stmt2 = select(Participant.conversation_id).where(Participant.user_id == friend_id)
    res2 = await db.execute(stmt2)
    c_ids2 = {r for r in res2.scalars().all()}

    common_ids = c_ids1.intersection(c_ids2)

    if common_ids:
        for cid in common_ids:
            c = await db.get(Conversation, cid)
            if c and not c.is_group:
                pr = await db.execute(select(Participant).where(Participant.conversation_id == cid))
                participants = pr.scalars().all()
                if len(participants) == 2:
                    return {"conversation_id": cid}

    conv_id = await create_conversation(
        db,
        creator_id=current_user.id,
        participant_ids=[current_user.id, friend_id],
        name=None
    )

    await db.commit()
    return {"conversation_id": conv_id}


@router.post("/conversations/sync_teams")
async def sync_all_user_teams(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):

    teams_info = await get_all_teams_for_user(current_user.id)
    synced_convs = []
    for team_info in teams_info:
        team_id = team_info["team_id"]
        project_slug = team_info["project_slug"]
        member_ids = team_info["member_ids"] or []

        if current_user.id not in member_ids:
            member_ids.append(current_user.id)

        if len(member_ids) < 2:
            continue

        link_q = select(TeamConversationLink).filter(
            TeamConversationLink.team_id == team_id,
            TeamConversationLink.project_slug == project_slug,
        )
        link_res = await db.execute(link_q)
        link = link_res.scalars().first()

        if link:
            conv_id = link.conversation_id
        else:
            conv_name = f"{team_info['project_name']} - Team {team_id}"
            conv_id = await create_conversation(
                db=db,
                creator_id=current_user.id,
                participant_ids=member_ids,
                name=conv_name,
            )
            new_link = TeamConversationLink(
                team_id=team_id,
                project_slug=project_slug,
                conversation_id=conv_id,
            )
            db.add(new_link)
            try:
                await db.commit()
            except Exception as e:
                await db.rollback()
                from sqlalchemy import delete
                await db.execute(delete(Participant).where(Participant.conversation_id == conv_id))
                await db.execute(delete(Conversation).where(Conversation.id == conv_id))
                await db.commit()
                link_res = await db.execute(link_q)
                link = link_res.scalars().first()
                if link:
                    conv_id = link.conversation_id
                else:
                    raise e

        part_q = select(Participant).filter(Participant.conversation_id == conv_id)
        pr = await db.execute(part_q)
        existing_parts = pr.scalars().all()
        existing_ids = {p.user_id for p in existing_parts}

        missing_ids = [uid for uid in member_ids if uid not in existing_ids]
        if missing_ids:
            for uid in missing_ids:
                db.add(Participant(conversation_id=conv_id, user_id=uid, is_admin=False))
            await db.commit()

        synced_convs.append(conv_id)

    return {"synced": len(synced_convs)}


@router.post("/conversations/team")
async def ensure_team_conversation(
    payload: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):

    project_slug = (payload.get("project_slug") or "").strip()
    if not project_slug:
        raise HTTPException(status_code=400, detail="project_slug requis")

    team_info = await get_team_for_user_and_project(current_user.id, project_slug)
    if not team_info:
        raise HTTPException(
            status_code=404,
            detail="Aucune équipe approuvée trouvée pour ce projet",
        )

    team_id = team_info["team_id"]
    member_ids = team_info["member_ids"] or []
    if current_user.id not in member_ids:
        member_ids.append(current_user.id)

    if len(member_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="Une équipe doit avoir au moins 2 membres pour avoir un groupe de projet"
        )

    link_q = select(TeamConversationLink).filter(
        TeamConversationLink.team_id == team_id,
        TeamConversationLink.project_slug == project_slug,
    )
    link_res = await db.execute(link_q)
    link = link_res.scalars().first()

    if link:
        conv_id = link.conversation_id
    else:
        conv_name = f"{team_info['project_name']} - Team {team_id}"
        conv_id = await create_conversation(
            db=db,
            creator_id=current_user.id,
            participant_ids=member_ids,
            name=conv_name,
        )
        link = TeamConversationLink(
            team_id=team_id,
            project_slug=project_slug,
            conversation_id=conv_id,
        )
        db.add(link)
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            from sqlalchemy import delete
            await db.execute(delete(Participant).where(Participant.conversation_id == conv_id))
            await db.execute(delete(Conversation).where(Conversation.id == conv_id))
            await db.commit()
            
            link_res = await db.execute(link_q)
            link = link_res.scalars().first()
            if link:
                conv_id = link.conversation_id
            else:
                raise e

    part_q = select(Participant).filter(Participant.conversation_id == conv_id)
    pr = await db.execute(part_q)
    existing_parts = pr.scalars().all()
    existing_ids = {p.user_id for p in existing_parts}

    missing_ids = [uid for uid in member_ids if uid not in existing_ids]
    if missing_ids:
        for uid in missing_ids:
            db.add(Participant(conversation_id=conv_id, user_id=uid, is_admin=False))
        await db.commit()

    conv = await db.get(Conversation, conv_id)
    return {
        "conversation": {
            "id": conv_id,
            "name": conv.name,
            "is_group": conv.is_group,
        }
    }

@router.post("/conversations")
async def create_conv(payload: dict, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    participant_ids = payload.get("participant_ids", [])
    name = payload.get("name")
    conv_id = await create_conversation(db, current_user.id, participant_ids, name)

    qp = select(Participant).filter(Participant.conversation_id == conv_id, Participant.user_id == current_user.id)
    pr = await db.execute(qp)
    if not pr.scalars().first():
        await db.execute(insert(Participant).values(conversation_id=conv_id, user_id=current_user.id, is_admin=True))
        try:
            await db.commit()
        except Exception:
            # ignorer
            await db.rollback()

    return {"conversation_id": conv_id}


@router.put("/messages/{msg_id}")
async def put_message(msg_id: int, payload: dict, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    new_content = payload.get("content")
    try:
        m = await update_message(db, msg_id, current_user.id, new_content)
    except PermissionError:
        raise HTTPException(status_code=403, detail="forbidden")
    if not m:
        raise HTTPException(status_code=404, detail="not found")
    try:
        import app as _app_pkg
        app = getattr(_app_pkg, "app", None)
    except Exception:
        app = None
    payload_out = {"type":"message_edited", "message": {"id": m.id, "conversation_id": m.conversation_id, "sender_id": m.user_id, "content": m.content, "created_at": m.created_at.isoformat(), "edited": True}}
    await manager.broadcast(m.conversation_id, payload_out)
    if app:
        await publish_message_to_redis(app, m.conversation_id, payload_out)
    return {"ok": True, "message": payload_out}

@router.delete("/messages/{msg_id}")
async def del_message(msg_id: int, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    try:
        m = await delete_message(db, msg_id, current_user.id)
    except PermissionError:
        raise HTTPException(status_code=403, detail="forbidden")
    if not m:
        raise HTTPException(status_code=404, detail="not found")
    try:
        import app as _app_pkg
        app = getattr(_app_pkg, "app", None)
    except Exception:
        app = None
    payload_out = {"type":"message_deleted", "message_id": msg_id}
    conv_id = getattr(m, "conversation_id", None)
    if conv_id:
        await manager.broadcast(conv_id, payload_out)
        if app:
            await publish_message_to_redis(app, conv_id, payload_out)
    return {"ok": True}

@router.post("/conversations/{conv_id}/messages/{msg_id}/read")
async def post_mark_read(conv_id: int, msg_id: int, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    # check 
    qp = select(Participant).filter(Participant.conversation_id == conv_id, Participant.user_id == current_user.id)
    pr = await db.execute(qp)
    if not pr.scalars().first():
        raise HTTPException(status_code=403, detail="not participant")
    mr = await mark_message_read(db, msg_id, current_user.id)
    payload = {"type":"read_receipt","message_id": msg_id, "user_id": current_user.id, "read_at": (mr.read_at.isoformat() if mr else datetime.utcnow().isoformat())}
    await manager.broadcast(conv_id, payload)
    try:
        import app as _app_pkg
        app = getattr(_app_pkg, "app", None)
    except Exception:
        app = None
    if app:
        await publish_message_to_redis(app, conv_id, payload)
    return {"ok": True}

@router.get("/conversations/{conv_id}/messages")
async def rest_get_messages(conv_id: int, limit: int = 50, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    # check 
    qp = select(Participant).filter(Participant.conversation_id == conv_id, Participant.user_id == current_user.id)
    pr = await db.execute(qp)
    if not pr.scalars().first():
        raise HTTPException(status_code=403, detail="User not participant")

    msgs = await get_messages_for_conv(db, conv_id, limit) 

 
    user_ids = list({m.user_id for m in msgs})
    users_map = {}   # id -> username
    avatars_map = {} # id -> avatar
    if user_ids:
        uq = select(User).filter(User.id.in_(user_ids))
        ur = await db.execute(uq)
        for u in ur.scalars().all():
            users_map[u.id] = u.username
            avatars_map[u.id] = u.avatar

    out = []
    
    read_map = {}
    msg_ids = [m.id for m in msgs]
    if msg_ids:
        from app.models import MessageRead
        read_q = select(MessageRead).filter(
            MessageRead.message_id.in_(msg_ids),
            MessageRead.user_id == current_user.id
        )
        read_r = await db.execute(read_q)
        for mr in read_r.scalars().all():
            read_map[mr.message_id] = mr.read_at.isoformat() if mr.read_at else None

    for m in reversed(msgs):
        out.append({
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender_id": m.user_id,
            "sender_username": users_map.get(m.user_id),
            "sender_avatar": avatars_map.get(m.user_id),
            "content": m.content,
            "attachment_url": m.attachment_url,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "edited": getattr(m, "edited", False),
            "deleted": getattr(m, "deleted", False),
            "read_at": read_map.get(m.id),
            "reactions": []
        })

    if msg_ids:
        rq = select(MessageReaction).filter(MessageReaction.message_id.in_(msg_ids))
        rr = await db.execute(rq)
        all_reactions = rr.scalars().all()

        import collections
        r_map = collections.defaultdict(list)
        for r in all_reactions:
            r_map[r.message_id].append({"emoji": r.emoji, "user_id": r.user_id})
        
        for item in out:
             if item["id"] in r_map:
                 item["reactions"] = r_map[item["id"]]
    return out

async def websocket_endpoint(websocket: WebSocket, conversation_id: int):
    # lire
    token = websocket.query_params.get("token")
    if not token:
        hdr = dict(websocket.headers).get("authorization")
        if hdr and hdr.startswith("Bearer "):
            token = hdr.split(" ", 1)[1]
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_jwt_token(token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    raw_user_id = payload.get("sub") or payload.get("user_id") or payload.get("userId")
    if not raw_user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        jwt_user_id = int(raw_user_id)
    except (TypeError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Resolve the actual chat DB user ID (may differ from main-backend JWT user_id)
    async with AsyncSessionLocal() as resolve_db:
        chat_user = await resolve_chat_user(payload, jwt_user_id, resolve_db)

    if not chat_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = chat_user.id  # Use the actual chat DB user ID for all operations

    # Collect already-online users before adding this new connection
    already_online = manager.get_online_user_ids(conversation_id)

    await manager.connect(conversation_id, websocket, user_id)

    try:
        import app as _app_pkg
        app = getattr(_app_pkg, "app", None)
    except Exception:
        app = None

    # Send the new user the presence of everyone already in the conversation
    for uid in already_online:
        if uid != user_id:
            await websocket.send_text(json.dumps({"type": "presence", "user_id": uid, "status": "online", "last_seen": None}))

    # Broadcast to everyone (including new user) that this user is now online
    presence_payload = {"type": "presence", "user_id": user_id, "status": "online", "last_seen": None}
    await manager.broadcast(conversation_id, presence_payload)
    if app and getattr(app, "state", None) and getattr(app.state, "redis", None):
        try:
            await app.state.redis.sadd("online", int(user_id))
            await app.state.redis.publish("chat:presence", json.dumps({"user_id":int(user_id),"status":"online"}))
        except Exception:
            logger.exception("redis presence publish failed")

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") == "send_message":
                content = data.get("content")
                client_temp_id = data.get("client_temp_id")
                attachment_url = data.get("attachment_url")

       
                async with AsyncSessionLocal() as session:
                    cq = select(Conversation).filter(Conversation.id == conversation_id)
                    cr = await session.execute(cq)
                    conv = cr.scalars().first()
                    
                    if conv and not conv.is_group:
                         pq = select(Participant).filter(Participant.conversation_id == conversation_id, Participant.user_id != int(user_id))
                         pr = await session.execute(pq)
                         other_part = pr.scalars().first()
                         
                         logger.info(f"DEBUG BLOCK: User={user_id} Conv={conversation_id} IsGroup={conv.is_group} OtherPart={other_part.user_id if other_part else 'None'}")

                         if other_part:
                             bq = select(UserBlock).filter(UserBlock.blocker_id == other_part.user_id, UserBlock.blocked_id == int(user_id))
                             br = await session.execute(bq)
                             is_blocked = br.scalars().first()
                             logger.info(f"DEBUG BLOCK: Check if {other_part.user_id} blocked {user_id} -> {is_blocked}")
                             
                             if is_blocked:
                                 logger.info(f"BLOCKED ACTION: Preventing sending.")
                                 await websocket.send_text(json.dumps({"type":"error", "code": "blocked", "message": "You are blocked by this user."}))
                                 continue
                             
                             bq2 = select(UserBlock).filter(UserBlock.blocker_id == int(user_id), UserBlock.blocked_id == other_part.user_id)
                             br2 = await session.execute(bq2)
                             i_blocked_them = br2.scalars().first()
                             logger.info(f"DEBUG BLOCK: Check if {user_id} blocked {other_part.user_id} -> {i_blocked_them}")

                             if i_blocked_them:
                                 logger.info(f"BLOCKING ACTION: Preventing sending.")
                                 await websocket.send_text(json.dumps({"type":"error", "code": "blocking", "message": "Unblock this user to send messages."}))
                                 continue
                         else:
                             logger.warning(f"DEBUG BLOCK: Could not find other participant in DM conversation {conversation_id} for user {user_id}")

                    mid, created_at = await persist_message(
                        session,
                        conversation_id,
                        int(user_id),
                        content,
                        attachment_url,
                    )
                
                sender_username = None
                try:
                    async with AsyncSessionLocal() as s2:
                        rq = select(User).filter(User.id == int(user_id))
                        r = await s2.execute(rq)
                        sender = r.scalars().first()
                        sender_username = sender.username if sender else None
                except Exception:
                    pass

                sender_avatar = None
                try:
                    async with AsyncSessionLocal() as s3:
                        rq3 = select(User).filter(User.id == int(user_id))
                        r3 = await s3.execute(rq3)
                        sender_obj = r3.scalars().first()
                        sender_avatar = sender_obj.avatar if sender_obj else None
                except Exception:
                    pass

                message_payload = {
                    "id": mid,
                    "conversation_id": conversation_id,
                    "sender_id": int(user_id),
                    "sender_username": sender_username,
                    "sender_avatar": sender_avatar,
                    "content": content,
                    "attachment_url": attachment_url,
                    "created_at": created_at.isoformat()
                }

                ack = {"type":"ack","client_temp_id": client_temp_id, "message_id": mid, "created_at": created_at.isoformat()}
                await websocket.send_text(json.dumps(ack))

                await manager.broadcast(conversation_id, {"type":"message","message":message_payload})

                if app:
                    await publish_message_to_redis(app, conversation_id, message_payload)

            elif data.get("type") == "typing":
                is_typing = data.get("is_typing", False)
                payload = {"type": "typing", "user_id": int(user_id), "is_typing": is_typing, "conversation_id": conversation_id}
                await manager.broadcast(conversation_id, payload)

            elif data.get("type") == "edit_message":
                try:
                    message_id = int(data.get("message_id"))
                except (TypeError, ValueError):
                    continue
                new_content = data.get("content")
                async with AsyncSessionLocal() as session:
                    try:
                        m = await update_message(session, message_id, int(user_id), new_content)
                    except PermissionError:
                        await websocket.send_text(json.dumps({"type":"error","message":"forbidden"}))
                        continue
                if m:
                    payload = {"type":"message_edited", "message":{"id": m.id, "conversation_id": m.conversation_id, "sender_id": m.user_id, "sender_username": None, "content": m.content, "created_at": m.created_at.isoformat(), "edited": True}}
                    await manager.broadcast(conversation_id, payload)
                    if app:
                        await publish_message_to_redis(app, conversation_id, payload)

            elif data.get("type") == "delete_message":
                raw_mid = data.get("message_id")
                try:
                    message_id = int(raw_mid)
                except (TypeError, ValueError):
                    await websocket.send_text(json.dumps({"type":"error","message":"invalid message id"}))
                    continue
                async with AsyncSessionLocal() as session:
                    try:
                        m = await delete_message(session, message_id, int(user_id))
                    except PermissionError:
                        await websocket.send_text(json.dumps({"type":"error","message":"forbidden"}))
                        continue
                if m:
                    payload = {"type":"message_deleted", "message_id": message_id}
                    await manager.broadcast(conversation_id, payload)
                    if app:
                        await publish_message_to_redis(app, conversation_id, payload)

            elif data.get("type") == "mark_read":
                message_id = data.get("message_id")
                async with AsyncSessionLocal() as session:
                    mr = await mark_message_read(session, message_id, int(user_id))
                payload = {"type":"read_receipt", "message_id": message_id, "user_id": int(user_id), "read_at": (mr.read_at.isoformat() if mr else datetime.utcnow().isoformat())}
                await manager.broadcast(conversation_id, payload)
                if app:
                    await publish_message_to_redis(app, conversation_id, payload)

            elif data.get("type") == "presence":
                payload = {"type":"presence","user_id": int(user_id), "status": data.get("status"), "last_seen": data.get("last_seen")}
                await manager.broadcast(conversation_id, payload)

            elif data.get("type") == "add_reaction":
                message_id = data.get("message_id")
                emoji = data.get("emoji")
                async with AsyncSessionLocal() as session:
                    r = await add_reaction(session, message_id, int(user_id), emoji)
                if r:
                    payload = {"type": "reaction_added", "message_id": message_id, "user_id": int(user_id), "emoji": emoji}
                    await manager.broadcast(conversation_id, payload)
                    if app:
                        await publish_message_to_redis(app, conversation_id, payload)

            elif data.get("type") == "remove_reaction":
                message_id = data.get("message_id")
                emoji = data.get("emoji")
                async with AsyncSessionLocal() as session:
                    await remove_reaction(session, message_id, int(user_id), emoji)
                payload = {"type": "reaction_removed", "message_id": message_id, "user_id": int(user_id), "emoji": emoji}
                await manager.broadcast(conversation_id, payload)
                if app:
                    await publish_message_to_redis(app, conversation_id, payload)

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
    except Exception as e:
        import traceback
        logger.error(f"WebSocket loop error: {e}")
        logger.error(traceback.format_exc())
        manager.disconnect(conversation_id, websocket)