from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, dj, guests, me, queue, rooms, venues

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Soundtrack Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(venues.router)
app.include_router(rooms.router)
app.include_router(guests.router)
app.include_router(queue.router)
app.include_router(dj.router)
app.include_router(me.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
