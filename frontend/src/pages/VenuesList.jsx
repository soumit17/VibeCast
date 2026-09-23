import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function VenuesList() {
  const [venues, setVenues] = useState(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setVenues(await api.listVenues());
    } catch (err) {
      setError(err.detail || "Could not load venues");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.createVenue(name, address);
      setName("");
      setAddress("");
      await load();
    } catch (err) {
      setError(err.detail || "Could not create venue");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Venue platform</span>
          <h2 style={{ marginBottom: 4 }}>Your venues</h2>
        </div>
      </div>

      <div className="grid-2">
        <div>
          {venues === null ? (
            <div className="empty-state">
              <span className="spinner" />
            </div>
          ) : venues.length === 0 ? (
            <div className="card empty-state">
              <p>No venues yet — create one to get a room and a QR code.</p>
            </div>
          ) : (
            <div className="queue-list">
              {venues.map((v) => (
                <Link key={v.id} to={`/venues/${v.id}`} className="card queue-item" style={{ textDecoration: "none" }}>
                  <div className="meta">
                    <div className="title">{v.name}</div>
                    <div className="artist">{v.address || "No address set"}</div>
                  </div>
                  <span className="btn btn-ghost btn-sm">Manage →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: "1.05rem" }}>New venue</h3>
          <form onSubmit={onCreate}>
            <div className="field">
              <label htmlFor="vname">Name</label>
              <input id="vname" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="vaddress">Address</label>
              <input id="vaddress" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create venue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
