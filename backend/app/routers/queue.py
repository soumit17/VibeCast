from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import QueueTrack, Room
from app.schemas import QueueBidRequest, QueueTrackCreate, QueueTrackOut, QueueVoteRequest
from app.services.deezer import search_track
from app.services.payment import process_payment
from app.ws import manager

router = APIRouter(tags=["queue"])


def _score(track: QueueTrack) -> float:
    return track.vote_count + track.bid_amount * settings.bid_weight


def _to_out(track: QueueTrack) -> QueueTrackOut:
    return QueueTrackOut(
        id=track.id,
        title=track.title,
        artist=track.artist,
        requested_by=track.requested_by,
        vote_count=track.vote_count,
        bid_amount=track.bid_amount,
        played=track.played,
        preview_url=track.preview_url,
        cover_url=track.cover_url,
        score=_score(track),
    )


def _ranked(db: Session, room_id: str) -> list[QueueTrack]:
    tracks = db.query(QueueTrack).filter(QueueTrack.room_id == room_id, QueueTrack.played == False).all()  # noqa: E712
    return sorted(tracks, key=_score, reverse=True)


async def _broadcast_queue(db: Session, room_id: str) -> None:
    queue_out = [_to_out(t).model_dump() for t in _ranked(db, room_id)]
    await manager.broadcast(room_id, {"type": "queue_update", "queue": queue_out})


@router.post("/api/rooms/{room_id}/queue", response_model=QueueTrackOut)
async def add_track(room_id: str, payload: QueueTrackCreate, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    track = QueueTrack(
        room_id=room_id,
        title=payload.title,
        artist=payload.artist,
        requested_by=payload.requested_by,
    )

    match = await search_track(payload.title, payload.artist)
    if match:
        track.preview_url = match["preview_url"]
        track.cover_url = match["cover_url"]

    db.add(track)
    db.commit()
    db.refresh(track)
    await _broadcast_queue(db, room_id)
    return _to_out(track)


@router.get("/api/rooms/{room_id}/queue", response_model=list[QueueTrackOut])
def get_queue(room_id: str, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return [_to_out(t) for t in _ranked(db, room_id)]


@router.post("/api/rooms/{room_id}/queue/vote", response_model=QueueTrackOut)
async def vote_track(room_id: str, payload: QueueVoteRequest, db: Session = Depends(get_db)):
    track = db.get(QueueTrack, payload.track_id)
    if track is None or track.room_id != room_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found in this room")
    track.vote_count += 1
    db.add(track)
    db.commit()
    db.refresh(track)
    await _broadcast_queue(db, room_id)
    return _to_out(track)


@router.post("/api/rooms/{room_id}/queue/bid", response_model=QueueTrackOut)
async def bid_track(room_id: str, payload: QueueBidRequest, db: Session = Depends(get_db)):
    track = db.get(QueueTrack, payload.track_id)
    if track is None or track.room_id != room_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found in this room")

    if not process_payment(payload.amount):
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment failed")

    track.bid_amount += payload.amount
    db.add(track)
    db.commit()
    db.refresh(track)
    await _broadcast_queue(db, room_id)
    return _to_out(track)


@router.post("/api/rooms/{room_id}/queue/{track_id}/played", response_model=QueueTrackOut)
async def mark_played(room_id: str, track_id: str, db: Session = Depends(get_db)):
    track = db.get(QueueTrack, track_id)
    if track is None or track.room_id != room_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found in this room")
    track.played = True
    db.add(track)
    db.commit()
    db.refresh(track)
    await _broadcast_queue(db, room_id)
    return _to_out(track)


@router.websocket("/api/rooms/{room_id}/live")
async def room_live(websocket: WebSocket, room_id: str):
    await manager.connect(room_id, websocket)
    try:
        while True:
            # Guest/dashboard clients are broadcast-only listeners; drain any
            # inbound pings/messages so the socket doesn't buffer indefinitely.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
