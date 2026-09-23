from fastapi import APIRouter, Depends

from app.auth import get_optional_user
from app.models import User
from app.schemas import MoodOut, MoodRequest
from app.services.llm import fuse_mood
from app.services.weather import get_weather

router = APIRouter(prefix="/api/me", tags=["personal"])


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
