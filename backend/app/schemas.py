from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---- Auth ----

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    top_artists: list[str]
    top_genres: list[str]
    music_connected: bool

    class Config:
        from_attributes = True


# ---- Venues ----

class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = ""


class VenueOut(BaseModel):
    id: str
    name: str
    address: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Rooms ----

class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class RoomOut(BaseModel):
    id: str
    venue_id: str
    name: str
    is_active: bool
    crowd_snapshot: dict
    created_at: datetime

    class Config:
        from_attributes = True


class QrOut(BaseModel):
    join_url: str
    qr_png_base64: str


# ---- Guests ----

class GuestJoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    connect_music: bool = False


class GuestOut(BaseModel):
    id: str
    display_name: str
    top_artists: list[str]
    top_genres: list[str]
    music_connected: bool
    user_id: str | None

    class Config:
        from_attributes = True


class TasteBlendEntry(BaseModel):
    genre: str
    count: int


# ---- Queue ----

class QueueTrackCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    artist: str = Field(min_length=1, max_length=500)
    requested_by: str = ""


class QueueVoteRequest(BaseModel):
    track_id: str


class QueueBidRequest(BaseModel):
    track_id: str
    amount: float = Field(gt=0)


class QueueTrackOut(BaseModel):
    id: str
    title: str
    artist: str
    requested_by: str
    vote_count: int
    bid_amount: float
    played: bool
    preview_url: str | None
    cover_url: str | None
    score: float

    class Config:
        from_attributes = True


# ---- DJ engine ----

class DjSuggestionOut(BaseModel):
    suggested_track: str
    suggested_artist: str
    reasoning: str
    target_energy: float
    target_valence: float
    queue_track: QueueTrackOut | None = None


# ---- Personal app ----

class MoodRequest(BaseModel):
    mic_energy: float = Field(ge=0, le=1, default=0.0)
    camera_frame_base64: str | None = None
    lat: float | None = None
    lon: float | None = None


class MoodOut(BaseModel):
    valence: float
    energy: float
    tempo: float
    summary: str


class PersonalTrackOut(BaseModel):
    title: str
    artist: str
    preview_url: str
    cover_url: str | None
