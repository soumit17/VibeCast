from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Room, User, Venue
from app.schemas import QrOut, RoomCreate, RoomOut
from app.services.crowd import analyze_crowd
from app.services.qr import build_join_url, generate_qr_png_base64
from app.ws import manager

router = APIRouter(tags=["rooms"])


def _get_owned_venue(venue_id: str, current_user: User, db: Session) -> Venue:
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    if venue.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your venue")
    return venue


@router.post("/api/venues/{venue_id}/rooms", response_model=RoomOut)
def create_room(
    venue_id: str,
    payload: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_venue(venue_id, current_user, db)
    room = Room(venue_id=venue_id, name=payload.name, crowd_snapshot={})
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/api/venues/{venue_id}/rooms", response_model=list[RoomOut])
def list_rooms(
    venue_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_venue(venue_id, current_user, db)
    return db.query(Room).filter(Room.venue_id == venue_id).order_by(Room.created_at.desc()).all()


@router.get("/api/rooms/{room_id}", response_model=RoomOut)
def get_room(room_id: str, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.get("/api/rooms/{room_id}/qr", response_model=QrOut)
def get_room_qr(room_id: str, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    join_url = build_join_url(room_id)
    return QrOut(join_url=join_url, qr_png_base64=generate_qr_png_base64(join_url))


@router.post("/api/rooms/{room_id}/crowd-scan", response_model=RoomOut)
async def crowd_scan(room_id: str, demo_index: int | None = None, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    room.crowd_snapshot = analyze_crowd(room_id, demo_index=demo_index)
    db.add(room)
    db.commit()
    db.refresh(room)
    await manager.broadcast(room_id, {"type": "crowd_update", "crowd_snapshot": room.crowd_snapshot})
    return room
