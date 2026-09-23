import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, roomSocketUrl } from "../api";
import QRCode from "../components/QRCode";
import CrowdPanel from "../components/CrowdPanel";
import QueueList from "../components/QueueList";

const DEMO_INTERVAL_MS = 15000;

export default function VenueDashboard() {
  const { venueId } = useParams();
  const [venue, setVenue] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [error, setError] = useState("");

  const [room, setRoom] = useState(null);
  const [qr, setQr] = useState(null);
  const [queue, setQueue] = useState([]);
  const [tasteBlend, setTasteBlend] = useState([]);
  const [guestCount, setGuestCount] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [dj, setDj] = useState({ loading: false, result: null, error: "" });

  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const demoIndexRef = useRef(0);

  useEffect(() => {
    api.getVenue(venueId).then(setVenue).catch(() => {});
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  async function loadRooms() {
    try {
      const list = await api.listRooms(venueId);
      setRooms(list);
      if (list.length > 0 && !selectedRoomId) setSelectedRoomId(list[0].id);
    } catch (err) {
      setError(err.detail || "Could not load rooms");
    }
  }

  async function onCreateRoom(e) {
    e.preventDefault();
    setCreatingRoom(true);
    try {
      const created = await api.createRoom(venueId, newRoomName);
      setNewRoomName("");
      await loadRooms();
      setSelectedRoomId(created.id);
    } catch (err) {
      setError(err.detail || "Could not create room");
    } finally {
      setCreatingRoom(false);
    }
  }

  const loadRoomData = useCallback(async (roomId) => {
    try {
      const [roomData, qrData, queueData, blendData, guests] = await Promise.all([
        api.getRoom(roomId),
        api.getRoomQr(roomId),
        api.getQueue(roomId),
        api.tasteBlend(roomId),
        api.listGuests(roomId),
      ]);
      setRoom(roomData);
      setQr(qrData);
      setQueue(queueData);
      setTasteBlend(blendData);
      setGuestCount(guests.length);
    } catch (err) {
      setError(err.detail || "Could not load room");
    }
  }, []);

  useEffect(() => {
    if (!selectedRoomId) return;
    setDj({ loading: false, result: null, error: "" });
    loadRoomData(selectedRoomId);

    const ws = new WebSocket(roomSocketUrl(selectedRoomId));
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

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [selectedRoomId, loadRoomData]);

  useEffect(() => {
    if (!demoMode || !selectedRoomId) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      return;
    }
    async function tick() {
      try {
        const updated = await api.crowdScan(selectedRoomId, demoIndexRef.current);
        setRoom(updated);
        demoIndexRef.current = (demoIndexRef.current + 1) % 3;
      } catch {
        // keep the last read on a transient failure
      }
    }
    tick();
    demoIntervalRef.current = setInterval(tick, DEMO_INTERVAL_MS);
    return () => clearInterval(demoIntervalRef.current);
  }, [demoMode, selectedRoomId]);

  async function manualScan() {
    try {
      const updated = await api.crowdScan(selectedRoomId);
      setRoom(updated);
    } catch (err) {
      setError(err.detail || "Crowd scan failed");
    }
  }

  async function onMarkPlayed(trackId) {
    await api.markPlayed(selectedRoomId, trackId);
  }

  async function requestDjSuggestion() {
    setDj({ loading: true, result: null, error: "" });
    try {
      const result = await api.djSuggest(selectedRoomId);
      setDj({ loading: false, result, error: "" });
    } catch (err) {
      setDj({ loading: false, result: null, error: err.detail || "DJ engine failed" });
    }
  }

  async function addSuggestionToQueue() {
    if (!dj.result) return;
    await api.addTrack(selectedRoomId, dj.result.suggested_track, dj.result.suggested_artist, "AI DJ");
  }

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Venue platform</span>
          <h2 style={{ marginBottom: 4 }}>{venue?.name || "Loading…"}</h2>
          <p style={{ margin: 0 }}>{venue?.address}</p>
        </div>
        <select
          value={selectedRoomId || ""}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          {(rooms || []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Create a room</h2>
        </div>
        <form className="row" onSubmit={onCreateRoom}>
          <input
            required
            placeholder="e.g. Friday Night Floor"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "11px 14px",
              color: "var(--text)",
            }}
          />
          <button className="btn btn-primary" type="submit" disabled={creatingRoom}>
            {creatingRoom ? "Creating…" : "Create room"}
          </button>
        </form>
        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {!selectedRoomId ? (
        <div className="empty-state">
          <p>Create a room to get a QR code and start reading the crowd.</p>
        </div>
      ) : (
        <div className="grid-2">
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">
                <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Crowd read</h2>
                <div className="demo-toggle">
                  <button
                    className={`btn btn-sm ${demoMode ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setDemoMode((v) => !v)}
                  >
                    {demoMode ? "Demo mode: on" : "Demo mode"}
                  </button>
                  {!demoMode && (
                    <button className="btn btn-secondary btn-sm" onClick={manualScan}>
                      Scan now
                    </button>
                  )}
                </div>
              </div>
              <CrowdPanel crowd={room?.crowd_snapshot} />
            </div>

            <div className="card dj-panel">
              <div className="section-title">
                <h2 style={{ fontSize: "1.05rem", margin: 0 }}>AI DJ</h2>
                <button className="btn btn-primary btn-sm" onClick={requestDjSuggestion} disabled={dj.loading}>
                  {dj.loading ? "Reading the room…" : "Suggest next track"}
                </button>
              </div>
              {dj.error && <div className="error-text">{dj.error}</div>}
              {dj.result && (
                <>
                  <h3 style={{ fontSize: "1.15rem" }}>
                    {dj.result.suggested_track} — {dj.result.suggested_artist}
                  </h3>
                  {dj.result.reasoning && <p className="dj-reasoning">&ldquo;{dj.result.reasoning}&rdquo;</p>}
                  <div className="row" style={{ marginBottom: 14 }}>
                    <span className="badge">energy {Math.round(dj.result.target_energy * 100)}%</span>
                    <span className="badge">valence {Math.round(dj.result.target_valence * 100)}%</span>
                  </div>
                  <button className="btn btn-secondary btn-block" onClick={addSuggestionToQueue}>
                    Add to queue
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <QRCode qr={qr} />
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{guestCount} guests connected</span>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {tasteBlend.slice(0, 8).map((t) => (
                  <span className="badge" key={t.genre}>
                    {t.genre} · {t.count}
                  </span>
                ))}
                {tasteBlend.length === 0 && <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>No guests yet</span>}
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Live queue</h2>
              </div>
              <QueueList tracks={queue} mode="venue" onMarkPlayed={onMarkPlayed} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
