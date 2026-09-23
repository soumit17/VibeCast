import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="container">
      <div className="hero">
        <span className="eyebrow">One taste graph, two contexts</span>
        <h1>Your music taste, read live and turned into sound.</h1>
        <p>
          Soundtrack builds a live "soundtrack of the moment" from your phone's mic, camera, and GPS — solo, or
          shared with an entire room. One account, one taste profile, applied automatically wherever you show up.
        </p>
        <div className="hero-actions">
          {user ? (
            <>
              <Link className="btn btn-primary" to="/me">
                Open my dashboard
              </Link>
              <Link className="btn btn-secondary" to="/venues">
                Manage venues
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" to="/register">
                Get started
              </Link>
              <Link className="btn btn-secondary" to="/login">
                Log in
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="product-grid">
        <div className="card product-card">
          <span className="tag">Personal app</span>
          <h3>A soundtrack that reads the room you're in</h3>
          <p>
            Mic energy, camera mood, GPS, and weather fuse into an ambient audio mix and live visualizer, generated
            entirely on-device. Works standalone — driving, walking, or chilling at home.
          </p>
        </div>
        <div className="card product-card">
          <span className="tag">Venue platform · B2B</span>
          <h3>An AI DJ that reads the crowd</h3>
          <p>
            Venues create a room, get a QR code, and let guests shape a live queue. The room blends guest tastes with
            a real crowd read, and guests can vote — or bid — to move a track up.
          </p>
        </div>
      </div>
    </div>
  );
}
