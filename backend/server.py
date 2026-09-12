from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import random
import string
import logging
import asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_code() -> str:
    # Human friendly, avoids ambiguous chars
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(5))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class CreateSessionInput(BaseModel):
    name: Optional[str] = None


class JoinInput(BaseModel):
    device_id: str
    name: str
    role: str = "camera"  # camera | director | alarm


class StateInput(BaseModel):
    target_id: str
    state: str  # idle | preview | live


class AlarmInput(BaseModel):
    target_id: str  # a device id or "all"
    message: str = "Alerte"
    sender: str = ""
    sound: bool = True
    vibrate: bool = True
    flash: bool = True


def clean(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        # code -> { device_id -> websocket }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, code: str, device_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(code, {})[device_id] = ws

    def disconnect(self, code: str, device_id: str):
        room = self.rooms.get(code)
        if room and device_id in room:
            del room[device_id]
            if not room:
                self.rooms.pop(code, None)

    async def send_to(self, code: str, device_id: str, message: dict) -> bool:
        room = self.rooms.get(code, {})
        ws = room.get(device_id)
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps(message))
            return True
        except Exception:
            return False

    async def broadcast(self, code: str, message: dict, exclude: Optional[str] = None):
        room = self.rooms.get(code, {})
        dead = []
        for did, ws in list(room.items()):
            if exclude and did == exclude:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(did)
        for did in dead:
            self.disconnect(code, did)


manager = ConnectionManager()


async def session_snapshot(code: str) -> dict:
    devices = await db.devices.find(
        {"session_code": code, "deleted_at": None}
    ).sort("created_at", 1).to_list(200)
    online = set(manager.rooms.get(code, {}).keys())
    out = []
    for d in devices:
        d = clean(d)
        d["connected"] = d["id"] in online
        out.append(d)
    return {"code": code, "devices": out}


async def broadcast_devices(code: str):
    snap = await session_snapshot(code)
    await manager.broadcast(code, {"type": "device_list", "devices": snap["devices"]})


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "StudioTally Pro API"}


@api_router.post("/sessions")
async def create_session(input: CreateSessionInput):
    # generate a unique code
    code = gen_code()
    for _ in range(10):
        existing = await db.sessions.find_one({"code": code, "deleted_at": None})
        if not existing:
            break
        code = gen_code()
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": input.name or "Studio",
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.sessions.insert_one(doc)
    return clean(doc)


@api_router.get("/sessions/{code}")
async def get_session(code: str):
    code = code.upper()
    session = await db.sessions.find_one({"code": code, "deleted_at": None})
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return await session_snapshot(code)


@api_router.post("/sessions/{code}/join")
async def join_session(code: str, input: JoinInput):
    code = code.upper()
    session = await db.sessions.find_one({"code": code, "deleted_at": None})
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")
    existing = await db.devices.find_one(
        {"session_code": code, "id": input.device_id, "deleted_at": None}
    )
    if existing:
        await db.devices.update_one(
            {"id": input.device_id, "session_code": code},
            {"$set": {"name": input.name, "role": input.role, "last_seen": now_iso()}},
        )
    else:
        await db.devices.insert_one({
            "id": input.device_id,
            "session_code": code,
            "name": input.name,
            "role": input.role,
            "state": "idle",
            "created_at": now_iso(),
            "last_seen": now_iso(),
            "deleted_at": None,
        })
    await broadcast_devices(code)
    return await session_snapshot(code)


@api_router.post("/sessions/{code}/leave")
async def leave_session(code: str, input: JoinInput):
    code = code.upper()
    await db.devices.update_one(
        {"id": input.device_id, "session_code": code},
        {"$set": {"deleted_at": now_iso()}},
    )
    await broadcast_devices(code)
    return {"ok": True}


@api_router.post("/sessions/{code}/state")
async def set_state(code: str, input: StateInput):
    code = code.upper()
    await db.devices.update_one(
        {"id": input.target_id, "session_code": code, "deleted_at": None},
        {"$set": {"state": input.state, "last_seen": now_iso()}},
    )
    await broadcast_devices(code)
    return {"ok": True}


@api_router.post("/sessions/{code}/alarm")
async def send_alarm(code: str, input: AlarmInput):
    code = code.upper()
    payload = {
        "type": "alarm",
        "message": input.message,
        "sender": input.sender,
        "sound": input.sound,
        "vibrate": input.vibrate,
        "flash": input.flash,
        "at": now_iso(),
    }
    if input.target_id == "all":
        await manager.broadcast(code, payload)
    else:
        await manager.send_to(code, input.target_id, payload)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Auth (Emergent-managed Google sign-in) — optional
# ---------------------------------------------------------------------------
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class SessionExchange(BaseModel):
    session_id: str


class LastSessionInput(BaseModel):
    code: str


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = authorization.split(" ", 1)[1]
    sess = await db.user_sessions.find_one({"session_token": token})
    if not sess:
        raise HTTPException(status_code=401, detail="Session invalide")
    expires = sess.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expirée")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


@api_router.post("/auth/session")
async def auth_session(body: SessionExchange):
    async with httpx.AsyncClient(timeout=15) as clientx:
        r = await clientx.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    data = r.json()
    email = data["email"]
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id}, {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = "user_" + uuid.uuid4().hex[:12]
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "last_session_code": None,
            "created_at": now_iso(),
        })

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.post("/auth/last-session")
async def save_last_session(body: LastSessionInput, user=Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_session_code": body.code.upper()}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@api_router.websocket("/ws/{code}/{device_id}")
async def ws_endpoint(websocket: WebSocket, code: str, device_id: str):
    code = code.upper()
    name = websocket.query_params.get("name", "Appareil")
    role = websocket.query_params.get("role", "camera")

    session = await db.sessions.find_one({"code": code, "deleted_at": None})
    if not session:
        await websocket.close(code=4404)
        return

    # upsert device
    existing = await db.devices.find_one(
        {"session_code": code, "id": device_id}
    )
    if existing:
        await db.devices.update_one(
            {"id": device_id, "session_code": code},
            {"$set": {"name": name, "role": role, "last_seen": now_iso(), "deleted_at": None}},
        )
    else:
        await db.devices.insert_one({
            "id": device_id,
            "session_code": code,
            "name": name,
            "role": role,
            "state": "idle",
            "created_at": now_iso(),
            "last_seen": now_iso(),
            "deleted_at": None,
        })

    await manager.connect(code, device_id, websocket)

    # send snapshot to the new client
    snap = await session_snapshot(code)
    await websocket.send_text(json.dumps({"type": "snapshot", **snap}))
    await broadcast_devices(code)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            mtype = msg.get("type")

            if mtype == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif mtype == "set_state":
                await db.devices.update_one(
                    {"id": msg["target_id"], "session_code": code, "deleted_at": None},
                    {"$set": {"state": msg["state"], "last_seen": now_iso()}},
                )
                await broadcast_devices(code)

            elif mtype == "blackout":
                await db.devices.update_many(
                    {"session_code": code, "deleted_at": None},
                    {"$set": {"state": "idle"}},
                )
                await broadcast_devices(code)

            elif mtype == "alarm":
                payload = {
                    "type": "alarm",
                    "message": msg.get("message", "Alerte"),
                    "sender": msg.get("sender", name),
                    "sound": msg.get("sound", True),
                    "vibrate": msg.get("vibrate", True),
                    "flash": msg.get("flash", True),
                    "at": now_iso(),
                }
                target = msg.get("target_id", "all")
                if target == "all":
                    await manager.broadcast(code, payload, exclude=device_id)
                else:
                    await manager.send_to(code, target, payload)

            elif mtype == "rename":
                await db.devices.update_one(
                    {"id": device_id, "session_code": code},
                    {"$set": {"name": msg.get("name", name)}},
                )
                await broadcast_devices(code)

    except WebSocketDisconnect:
        manager.disconnect(code, device_id)
        await db.devices.update_one(
            {"id": device_id, "session_code": code},
            {"$set": {"last_seen": now_iso()}},
        )
        await broadcast_devices(code)
    except Exception as e:
        logger.error(f"WS error: {e}")
        manager.disconnect(code, device_id)
        await broadcast_devices(code)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
