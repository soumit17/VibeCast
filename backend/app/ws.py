import json

from fastapi import WebSocket


class RoomConnectionManager:
    """Tracks live WebSocket connections per room and broadcasts queue/crowd updates."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        connections = self._rooms.get(room_id)
        if connections is not None:
            connections.discard(websocket)
            if not connections:
                self._rooms.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict) -> None:
        connections = self._rooms.get(room_id)
        if not connections:
            return
        payload = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            connections.discard(ws)


manager = RoomConnectionManager()
