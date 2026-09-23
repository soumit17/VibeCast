import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { TrackPlayer, MicMonitor } from "../audio/player";
import Visualizer from "../components/Visualizer";
import ShareCard from "../components/ShareCard";

const MOOD_INTERVAL_MS = 20000;

export default function PersonalDashboard() {
  const { user, refresh } = useAuth();
  const playerRef = useRef(null);
  const micRef = useRef(null);
  const videoRef = useRef(null);
  const snapshotCanvasRef = useRef(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const micLevelRafRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [perms, setPerms] = useState({ mic: false, cam: false, gps: false });
  const [coords, setCoords] = useState(null);
  const [mood, setMood] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState("");
  const [moodLoading, setMoodLoading] = useState(false);
  const [connectingMusic, setConnectingMusic] = useState(false);

  const [playlist, setPlaylist] = useState([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  useEffect(() => {
    playerRef.current = new TrackPlayer();
    micRef.current = new MicMonitor();
    playerRef.current.onEnded(() => playNextTrack());
    return () => {
      stopExperience();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  function captureFrameBase64() {
    const video = videoRef.current;
    const canvas = snapshotCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;
    canvas.width = 320;
    canvas.height = Math.round((320 * video.videoHeight) / video.videoWidth);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1] || null;
  }

  async function fetchMood() {
    setMoodLoading(true);
    try {
      const payload = {
        mic_energy: micRef.current ? micRef.current.getEnergy() : 0,
        camera_frame_base64: captureFrameBase64(),
        lat: coords?.lat,
        lon: coords?.lon,
      };
      const result = await api.mood(payload);
      setMood(result);
    } catch {
      // mood fusion has server-side fallback already; a network failure here
      // just means the last mood reading stays in place.
    } finally {
      setMoodLoading(false);
    }
  }

  async function playAtIndex(index, tracks) {
    const list = tracks || playlist;
    if (!list.length) return;
    const wrapped = ((index % list.length) + list.length) % list.length;
    setTrackIndex(wrapped);
    try {
      await playerRef.current.load(list[wrapped].preview_url);
      setIsPlaying(true);
    } catch {
      // Autoplay can be blocked outside a user gesture; the play/pause
      // button lets the user resume manually.
      setIsPlaying(false);
    }
  }

  function playNextTrack() {
    playAtIndex(trackIndex + 1);
  }

  function playPrevTrack() {
    playAtIndex(trackIndex - 1);
  }

  function togglePlayPause() {
    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current.resume().then(() => setIsPlaying(true)).catch(() => {});
    }
  }

  async function startExperience() {
    setError("");
    setPlaylistLoading(true);

    let tracks = [];
    try {
      tracks = await api.getPlaylist();
      setPlaylist(tracks);
    } catch (err) {
      setError(err.detail || "Could not build your playlist. Is your music library connected?");
      setPlaylistLoading(false);
      return;
    }
    setPlaylistLoading(false);

    setRunning(true);
    await playAtIndex(0, tracks);

    try {
      await micRef.current.connect();
      setPerms((p) => ({ ...p, mic: true }));
    } catch {
      setPerms((p) => ({ ...p, mic: false }));
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPerms((p) => ({ ...p, cam: true }));
    } catch {
      setPerms((p) => ({ ...p, cam: false }));
    }

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setPerms((p) => ({ ...p, gps: true }));
        },
        () => setPerms((p) => ({ ...p, gps: false })),
        { enableHighAccuracy: false, maximumAge: 60000 }
      );
    }

    function micLevelLoop() {
      setMicLevel(micRef.current ? micRef.current.getEnergy() : 0);
      micLevelRafRef.current = requestAnimationFrame(micLevelLoop);
    }
    micLevelLoop();

    fetchMood();
    intervalRef.current = setInterval(fetchMood, MOOD_INTERVAL_MS);
  }

  function stopExperience() {
    playerRef.current?.stop();
    micRef.current?.stop();
    setRunning(false);
    setIsPlaying(false);

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (micLevelRafRef.current) {
      cancelAnimationFrame(micLevelRafRef.current);
      micLevelRafRef.current = null;
    }
    setPerms({ mic: false, cam: false, gps: false });
  }

  async function connectMusic() {
    setConnectingMusic(true);
    try {
      await api.connectMusic();
      await refresh();
    } catch {
      setError("Could not connect music library right now.");
    } finally {
      setConnectingMusic(false);
    }
  }

  const nowPlaying = playlist[trackIndex];

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Personal app</span>
          <h2 style={{ marginBottom: 4 }}>Soundtrack of the moment</h2>
          <p style={{ margin: 0 }}>
            {user ? `Signed in as ${user.display_name}` : "Log in to build a soundtrack from your taste profile."}
          </p>
        </div>
        {running ? (
          <span className="badge badge-live">
            <span className="pulse" /> live
          </span>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="card card-elevated">
          <Visualizer engine={playerRef.current} active={running && isPlaying} accentHue={340 - (mood?.valence ?? 0.5) * 120} />

          {nowPlaying && (
            <div className="row" style={{ margin: "16px 0", alignItems: "center" }}>
              {nowPlaying.cover_url ? (
                <img src={nowPlaying.cover_url} alt="" style={{ width: 52, height: 52, borderRadius: 8 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 8, background: "var(--bg-elevated)" }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nowPlaying.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{nowPlaying.artist}</div>
              </div>
              <div className="row">
                <button className="btn btn-secondary btn-sm" onClick={playPrevTrack}>
                  ◀
                </button>
                <button className="btn btn-primary btn-sm" onClick={togglePlayPause}>
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={playNextTrack}>
                  ▶
                </button>
              </div>
            </div>
          )}

          <div className="permission-grid">
            <div className={`perm-chip ${perms.mic ? "granted" : ""}`}>🎙 Mic {perms.mic ? "on" : "off"}</div>
            <div className={`perm-chip ${perms.cam ? "granted" : ""}`}>📷 Camera {perms.cam ? "on" : "off"}</div>
            <div className={`perm-chip ${perms.gps ? "granted" : ""}`}>📍 GPS {perms.gps ? "on" : "off"}</div>
          </div>

          {!user ? (
            <p style={{ fontSize: "0.85rem" }}>Log in on the nav above, then connect a music library below.</p>
          ) : !user.music_connected ? (
            <>
              <p style={{ fontSize: "0.85rem" }}>Connect a music library to build a soundtrack from your taste profile.</p>
              <button className="btn btn-primary btn-block" onClick={connectMusic} disabled={connectingMusic}>
                {connectingMusic ? "Connecting…" : "Connect music library"}
              </button>
            </>
          ) : !running ? (
            <button className="btn btn-primary btn-block" onClick={startExperience} disabled={playlistLoading}>
              {playlistLoading ? "Building your playlist…" : "Start the soundtrack"}
            </button>
          ) : (
            <button className="btn btn-secondary btn-block" onClick={stopExperience}>
              Stop
            </button>
          )}

          {error && <div className="error-text">{error}</div>}

          {running && (
            <div style={{ marginTop: 18 }}>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Live mic level</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{Math.round(micLevel * 100)}%</span>
              </div>
              <div className="meter">
                <div className="meter-fill meter-fill-live" style={{ "--meter": micLevel }} />
              </div>
            </div>
          )}

          {running && (
            <p style={{ fontSize: "0.75rem", marginTop: 14 }}>
              Every ~20s, a camera snapshot and your mic level are sent for a one-off mood read — nothing is recorded
              or streamed continuously.
            </p>
          )}
          <video ref={videoRef} muted playsInline style={{ display: "none" }} />
          <canvas ref={snapshotCanvasRef} style={{ display: "none" }} />
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">
              <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Music library</h2>
            </div>
            {user ? (
              user.music_connected ? (
                <div>
                  <p style={{ marginBottom: 8 }}>Connected. Top genres:</p>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    {user.top_genres.map((g) => (
                      <span className="badge" key={g}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p>Not connected yet — use the button in the player panel.</p>
              )
            ) : (
              <p>Log in to connect a music library and save your taste profile across venues.</p>
            )}
          </div>

          <div className="card">
            <div className="section-title">
              <h2 style={{ fontSize: "1.05rem", margin: 0 }}>Mood readout</h2>
              {moodLoading && <span className="spinner" />}
            </div>
            {mood ? (
              <>
                <p style={{ color: "var(--text)", fontStyle: "italic" }}>&ldquo;{mood.summary}&rdquo;</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                  {[
                    ["Energy", mood.energy],
                    ["Valence", mood.valence],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="row-between" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{label}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {Math.round(value * 100)}%
                        </span>
                      </div>
                      <div className="meter">
                        <div className="meter-fill" style={{ "--meter": value }} />
                      </div>
                    </div>
                  ))}
                </div>
                <ShareCard mood={mood} />
              </>
            ) : (
              <p>Start the soundtrack to get a live mood read.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
