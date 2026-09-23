import { useRef, useState } from "react";

function BidControl({ onBid }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5");

  if (!open) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} title="Boost this track's position">
        Bid
      </button>
    );
  }

  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        const value = parseFloat(amount);
        if (value > 0) onBid(value);
        setOpen(false);
      }}
    >
      <input
        type="number"
        min="1"
        step="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{
          width: 56,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text)",
          padding: "4px 6px",
          fontSize: "0.8rem",
        }}
        autoFocus
      />
      <button className="btn btn-primary btn-sm" type="submit">
        Boost
      </button>
    </form>
  );
}

/**
 * Renders a ranked queue. `mode` controls which actions show:
 *  - "guest": vote + bid buttons, playable previews
 *  - "venue": playable previews + "mark played" button, no vote/bid
 */
export default function QueueList({ tracks, mode = "guest", onVote, onBid, onMarkPlayed }) {
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);

  function togglePlay(track) {
    if (!track.preview_url) return;
    const audio = audioRef.current;
    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = track.preview_url;
    audio.play().catch(() => {});
    setPlayingId(track.id);
  }

  if (!tracks || tracks.length === 0) {
    return (
      <div className="empty-state">
        <p>No tracks queued yet. Be the first to request one.</p>
      </div>
    );
  }

  return (
    <div className="queue-list">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      {tracks.map((track, i) => (
        <div className="queue-item" key={track.id}>
          <div className="rank">{i + 1}</div>
          {track.cover_url ? (
            <img className="cover" src={track.cover_url} alt="" />
          ) : (
            <div className="cover" />
          )}
          <div className="meta">
            <div className="title">{track.title}</div>
            <div className="artist">{track.artist}</div>
          </div>
          <div className="score">{track.score.toFixed(1)}</div>
          <div className="actions">
            {track.preview_url ? (
              <button className="btn btn-secondary btn-sm" onClick={() => togglePlay(track)}>
                {playingId === track.id ? "Pause" : "Play"}
              </button>
            ) : (
              <span className="badge" title="No 30s preview available for this track">
                no preview
              </span>
            )}
            {mode === "guest" && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => onVote(track.id)}>
                  ▲ {track.vote_count}
                </button>
                <BidControl onBid={(amount) => onBid(track.id, amount)} />
              </>
            )}
            {mode === "venue" && (
              <button className="btn btn-secondary btn-sm" onClick={() => onMarkPlayed(track.id)}>
                Mark played
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
