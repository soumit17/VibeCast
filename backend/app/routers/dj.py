from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import QueueTrack, Room, User, Venue
from app.routers.guests import taste_blend
from app.routers.queue import _to_out
from app.schemas import DjSuggestionOut, QueueTrackOut
from app.services.deezer import search_track
from app.services.llm import dj_suggest as llm_dj_suggest

router = APIRouter(tags=["dj"])


@router.post("/api/rooms/{room_id}/dj/suggest", response_model=DjSuggestionOut)
async def suggest_next_track(room_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    venue = db.get(Venue, room.venue_id)
    if venue is None or venue.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your venue")

    blend = [entry.model_dump() for entry in taste_blend(room_id, db)]

    recent_tracks = (
        db.query(QueueTrack)
        .filter(QueueTrack.room_id == room_id, QueueTrack.played == True)  # noqa: E712
        .order_by(QueueTrack.created_at.desc())
        .limit(5)
        .all()
    )
    recent_out = [{"title": t.title, "artist": t.artist} for t in recent_tracks]

    candidates = (
        db.query(QueueTrack)
        .filter(QueueTrack.room_id == room_id, QueueTrack.played == False)  # noqa: E712
        .all()
    )
    candidates_out = [_to_out(t).model_dump() for t in candidates]

    suggestion = await llm_dj_suggest(
        taste_blend=blend,
        crowd_snapshot=room.crowd_snapshot or {},
        recent_tracks=recent_out,
        queue_candidates=candidates_out,
    )

    queue_track_out: QueueTrackOut | None = None
    if suggestion["suggested_track"]:
        match = await search_track(suggestion["suggested_track"], suggestion["suggested_artist"])
        queue_track_out = QueueTrackOut(
            id="",
            title=suggestion["suggested_track"],
            artist=suggestion["suggested_artist"],
            requested_by="AI DJ",
            vote_count=0,
            bid_amount=0.0,
            played=False,
            preview_url=(match or {}).get("preview_url"),
            cover_url=(match or {}).get("cover_url"),
            score=0.0,
        )

    return DjSuggestionOut(
        suggested_track=suggestion["suggested_track"],
        suggested_artist=suggestion["suggested_artist"],
        reasoning=suggestion["reasoning"],
        target_energy=suggestion["target_energy"],
        target_valence=suggestion["target_valence"],
        queue_track=queue_track_out,
    )
