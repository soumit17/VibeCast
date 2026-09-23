import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    top_artists: Mapped[list] = mapped_column(JSON, default=list)
    top_genres: Mapped[list] = mapped_column(JSON, default=list)
    music_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    venues: Mapped[list["Venue"]] = relationship(back_populates="owner")


class Venue(Base):
    __tablename__ = "venues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    owner: Mapped["User"] = relationship(back_populates="venues")
    rooms: Mapped[list["Room"]] = relationship(back_populates="venue", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    venue_id: Mapped[str] = mapped_column(String(36), ForeignKey("venues.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    crowd_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    venue: Mapped["Venue"] = relationship(back_populates="rooms")
    guests: Mapped[list["GuestProfile"]] = relationship(back_populates="room", cascade="all, delete-orphan")
    queue: Mapped[list["QueueTrack"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class GuestProfile(Base):
    __tablename__ = "guest_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    top_artists: Mapped[list] = mapped_column(JSON, default=list)
    top_genres: Mapped[list] = mapped_column(JSON, default=list)
    music_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    room: Mapped["Room"] = relationship(back_populates="guests")


class QueueTrack(Base):
    __tablename__ = "queue_tracks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    artist: Mapped[str] = mapped_column(String(500), nullable=False)
    requested_by: Mapped[str] = mapped_column(String(255), default="")
    vote_count: Mapped[int] = mapped_column(Integer, default=0)
    bid_amount: Mapped[float] = mapped_column(Float, default=0.0)
    played: Mapped[bool] = mapped_column(Boolean, default=False)
    preview_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    room: Mapped["Room"] = relationship(back_populates="queue")
