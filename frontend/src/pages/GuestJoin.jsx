import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, roomSocketUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import QueueList from "../components/QueueList";
import CrowdPanel from "../components/CrowdPanel";

export default function GuestJoin() {
  const { roomId } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [guest, setGuest] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [connectMusic, setConnectMusic] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const [queue, setQueue] = useState([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [adding, setAdding] = useState(false);

  const wsRef = useRef(null);

  useEffect(() => {
    api.getRoom(roomId).then(setRoom).catch(() => setError("This room doesn't exist or isn't active."));
    if (user) setDisplayName(user.display_name);
  }, [roomId, user]);

  useEffect(() => {
    if (!guest) return;
    api.getQueue(roomId).then(setQueue).catch(() => {});

    const ws = new WebSocket(roomSocketUrl(roomId));
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "queue_update") setQueue(msg.queue);
        if (msg.type === "crowd_update") setRoom((r) => (r ? { ...r, crowd_snapshot: msg.crowd_snapshot } : r));
      } catch {
        // ignore malformed frames
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [guest, roomId]);

  async function onJoin(e) {
    e.preventDefault();
    setJoining(true);
    setError("");
    try {
      const g = await api.joinRoom(roomId, displayName, connectMusic, !!user);
      setGuest(g);
    } catch (err) {
      setError(err.detail || "Could not join this room");
    } finally {
      setJoining(false);
    }
  }

  async function onVote(trackId) {
    await api.voteTrack(roomId, trackId);
  }

  async function onBid(trackId, amount) {
    await api.bidTrack(roomId, trackId, amount);
  }

  async function onAddTrack(e) {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;
    setAdding(true);
    try {
      await api.addTrack(roomId, title, artist, guest.display_name);
      setTitle("");
      setArtist("");
    } catch (err) {
      setError(err.detail || "Could not add track");
    } finally {
      setAdding(false);
    }
  }

  if (error && !room) {
    return (
      <div className="container center-page">
        <div className="card" style={{ textAlign: "center" }}>
          <p>{error}</p>
          <Link className="btn btn-secondary" to="/">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="container center-page">
        <div className="card form-narrow" style={{ width: "100%" }}>
          <span className="eyebrow">{room?.name || "Loading…"}</span>
          <h2>Let the DJ read your vibe tonight?</h2>
          <p>
            {user
              ? "You're logged in — your saved taste profile will apply automatically, no re-entry needed."
              : "Join anonymously, or optionally connect a music library so the room's blend reflects your taste."}
          </p>
          <form onSubmit={onJoin}>
            <div className="field">
              <label htmlFor="displayName">Your name</label>
              <input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            {!user && (
              <div className="field field-checkbox">
                <input
                  id="connectMusic"
                  type="checkbox"
                  checked={connectMusic}
                  onChange={(e) => setConnectMusic(e.target.checked)}
                />
                <label htmlFor="connectMusic" style={{ textTransform: "none", fontWeight: 500 }}>
                  Connect my music library
                </label>
              </div>
            )}
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={joining}>
              {joining ? "Joining…" : "Join the room"}
            </button>
          </form>
          {!user && (
            <p style={{ marginTop: 16, fontSize: "0.85rem" }}>
              Already have a Soundtrack account? <Link to="/login">Log in first</Link> to skip straight to your saved
              profile.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">{room?.name}</span>
          <h2 style={{ marginBottom: 4 }}>You're in, {guest.display_name}</h2>
        </div>
        <span className="badge badge-live">
          <span className="pulse" /> live
        </span>
      </div>

      <div className="grid-2">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">
              <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Request a track</h2>
            </div>
            <form className="row" onSubmit={onAddTrack} style={{ flexWrap: "wrap" }}>
              <input
                required
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  flex: "1 1 140px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--text)",
                }}
              />
              <input
                required
                placeholder="Artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                style={{
                  flex: "1 1 140px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--text)",
                }}
              />
              <button className="btn btn-primary" type="submit" disabled={adding}>
                {adding ? "Adding…" : "Request"}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="section-title">
              <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Live queue</h2>
            </div>
            <QueueList tracks={queue} mode="guest" onVote={onVote} onBid={onBid} />
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Reading the room</h2>
          </div>
          <CrowdPanel crowd={room?.crowd_snapshot} />
        </div>
      </div>
    </div>
  );
}
