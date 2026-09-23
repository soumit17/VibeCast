from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_optional_user
from app.database import get_db
from app.models import GuestProfile, Room, User
from app.schemas import GuestJoinRequest, GuestOut, TasteBlendEntry
from app.services.music_connect import connect_music_library
from app.ws import manager

router = APIRouter(tags=["guests"])


@router.post("/api/rooms/{room_id}/join", response_model=GuestOut)
async def join_room(
    room_id: str,
    payload: GuestJoinRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    guest = GuestProfile(room_id=room_id, display_name=payload.display_name)

    if current_user is not None:
        # Logged-in guest: pull their real saved profile automatically, no re-entry (spec §1/§9.2)
        guest.user_id = current_user.id
        guest.top_artists = current_user.top_artists
        guest.top_genres = current_user.top_genres
        guest.music_connected = current_user.music_connected
    elif payload.connect_music:
        profile = connect_music_library(guest.id)
        guest.top_artists = profile["top_artists"]
        guest.top_genres = profile["top_genres"]
        guest.music_connected = True

    db.add(guest)
    db.commit()
    db.refresh(guest)

    # The venue dashboard shows guest count and the blended taste; without this
    # broadcast it keeps showing "0 connected" until the page is reloaded.
    await manager.broadcast(
        room_id,
        {
            "type": "guest_update",
            "guest_count": db.query(GuestProfile).filter(GuestProfile.room_id == room_id).count(),
            "taste_blend": [entry.model_dump() for entry in taste_blend(room_id, db)],
        },
    )
    return guest


@router.get("/api/rooms/{room_id}/guests", response_model=list[GuestOut])
def list_guests(room_id: str, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return db.query(GuestProfile).filter(GuestProfile.room_id == room_id).order_by(GuestProfile.joined_at.desc()).all()


@router.get("/api/rooms/{room_id}/taste-blend", response_model=list[TasteBlendEntry])
def taste_blend(room_id: str, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    guests = db.query(GuestProfile).filter(GuestProfile.room_id == room_id).all()
    counter: Counter[str] = Counter()
    for guest in guests:
        counter.update(guest.top_genres or [])

    return [TasteBlendEntry(genre=genre, count=count) for genre, count in counter.most_common()]
