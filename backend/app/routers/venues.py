from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Venue
from app.schemas import VenueCreate, VenueOut

router = APIRouter(prefix="/api/venues", tags=["venues"])


@router.post("", response_model=VenueOut)
def create_venue(payload: VenueCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    venue = Venue(owner_id=current_user.id, name=payload.name, address=payload.address)
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue


@router.get("", response_model=list[VenueOut])
def list_venues(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Venue).filter(Venue.owner_id == current_user.id).order_by(Venue.created_at.desc()).all()


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(venue_id: str, db: Session = Depends(get_db)):
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    return venue
