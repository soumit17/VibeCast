import random

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user, get_optional_user
from app.models import User
from app.schemas import MoodOut, MoodRequest, PersonalTrackOut
from app.services.deezer import get_artist_top_tracks
from app.services.llm import fuse_mood
from app.services.weather import get_weather

router = APIRouter(prefix="/api/me", tags=["personal"])

# How many of the user's top artists to pull from, and how many tracks per
# artist, when building the personal playlist. Kept small so the request
# stays fast (each artist costs two Deezer calls) while still giving enough
# tracks to auto-advance through for a while.
PLAYLIST_ARTIST_COUNT = 4
TRACKS_PER_ARTIST = 4


@router.post("/mood", response_model=MoodOut)
async def mood(payload: MoodRequest, current_user: User | None = Depends(get_optional_user)):
    weather = None
    if payload.lat is not None and payload.lon is not None:
        weather = await get_weather(payload.lat, payload.lon)

    taste_history = None
    if current_user is not None:
        taste_history = {"top_genres": current_user.top_genres}

    result = await fuse_mood(
        mic_energy=payload.mic_energy,
        camera_frame_base64=payload.camera_frame_base64,
        weather=weather,
        taste_history=taste_history,
    )
    return MoodOut(**result)


@router.get("/playlist", response_model=list[PersonalTrackOut])
async def playlist(current_user: User = Depends(get_current_user)):
    """Real tracks pulled from the logged-in user's connected top artists (spec
    §1's 'past music profile'), via Deezer — not titles invented by an LLM."""
    if not current_user.music_connected or not current_user.top_artists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect a music library first to generate a personal playlist",
        )

    artists = list(current_user.top_artists)
    random.shuffle(artists)
    artists = artists[:PLAYLIST_ARTIST_COUNT]

    tracks: list[dict] = []
    for artist in artists:
        tracks.extend(await get_artist_top_tracks(artist, limit=TRACKS_PER_ARTIST))

    if not tracks:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not find any playable tracks for this taste profile right now",
        )

    random.shuffle(tracks)
    return [PersonalTrackOut(**t) for t in tracks]
