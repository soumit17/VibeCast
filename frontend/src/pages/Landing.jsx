import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Reveal from "../components/Reveal";
import FauxQR from "../components/FauxQR";

const PHOTOS = {
  car: "photo-1485463611174-f302f6a5c1c9",
  room: "photo-1483412033650-1015ddeb83d1",
  venue: "photo-1516450360452-9312f5e86fc7",
};

const photoUrl = (id, w) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=75&w=${w}`;
const photoSrcSet = (id) => [640, 1000, 1400].map((w) => `${photoUrl(id, w)} ${w}w`).join(", ");

function SceneMedia({ photo, alt, label, children }) {
  return (
    <div className="scene-media">
      <img
        src={photoUrl(photo, 1000)}
        srcSet={photoSrcSet(photo)}
        sizes="(max-width: 900px) 100vw, 50vw"
        alt={alt}
        loading="lazy"
        decoding="async"
      />
      <div className="scene-media-scrim" />
      <span className="scene-marker">{label}</span>
      {children}
    </div>
  );
}

function Scene({ label, title, body, chips, photo, alt, flip, children }) {
  return (
    <section className={`scene${flip ? " scene-flip" : ""}`}>
      <div className="container scene-inner">
        <Reveal className="scene-copy">
          <h2>{title}</h2>
          <p>{body}</p>
          <ul className="scene-chips">
            {chips.map((chip) => (
              <li className="badge" key={chip}>
                {chip}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal variant="media" delay={110}>
          <SceneMedia photo={photo} alt={alt} label={label}>
            {children}
          </SceneMedia>
        </Reveal>
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="phone-mock" aria-hidden="true">
      <div className="phone-notch" />
      <div className="phone-screen">
        <span className="phone-eyebrow">Friday Night Floor</span>
        <p className="phone-title">Let the DJ read your vibe tonight?</p>
        <div className="phone-qr">
          <FauxQR size={74} />
        </div>
        <div className="phone-cta">Join the room</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div className="container">
          <Reveal>
            <h1>Your music taste, read live and turned into sound.</h1>
            <p>
              VibeCast builds a live &ldquo;soundtrack of the moment&rdquo; from your phone&rsquo;s mic, camera, and
              GPS — solo, or shared with an entire room. One account, one taste profile, applied automatically
              wherever you show up.
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
          </Reveal>
          <Reveal delay={220} className="scroll-cue">
            <span className="scroll-cue-line" />
            Three places it listens
          </Reveal>
        </div>
      </section>

      <Scene
        label="In the car"
        title="Midnight on the motorway, and the mix already knows."
        body="The mic hears road noise and how loud you are over it. GPS puts you on a dark stretch at 1am and pulls the weather down on top of that. Those go up as one read — energy, valence, tempo — and the next track comes back off your own profile to match it. No picking a playlist at 70mph."
        chips={["mic energy", "GPS", "weather"]}
        photo={PHOTOS.car}
        alt="Car interior at night, dashboard lit and light streaking past the windscreen"
      />

      <Scene
        label="In your room"
        title="A quiet Tuesday, read off the walls."
        body="Every twenty seconds a single camera frame goes up and comes back as a sentence describing the room. The visualizer moves on the actual audio coming out of your speakers, not a canned loop. When a read is worth keeping, the card is one tap from your camera roll."
        chips={["camera read", "live visualizer", "shareable card"]}
        photo={PHOTOS.room}
        alt="Vinyl records beside headphones in warm low light"
        flip
      />

      <Scene
        label="At the venue"
        title="Forty people, one queue, nothing shouted at the DJ."
        body="Scan the code on the table and you're in. No download, and no login unless you want your saved profile pulled through automatically. Vote a track up, or bid to push it higher. The room's blended taste and a live crowd read go to the DJ engine, which answers with what to play next and why."
        chips={["QR join", "vote & bid", "AI DJ"]}
        photo={PHOTOS.venue}
        alt="Crowd with hands raised under magenta and blue stage lighting"
      >
        <PhoneMock />
      </Scene>

      <section className="closing">
        <div className="container">
          <Reveal>
            <h2>Two contexts. One taste graph.</h2>
            <p>
              The profile you build on your own phone is the same one a venue reads the second you scan in. Nothing to
              re-enter, nothing to set up twice.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link className="btn btn-primary" to="/me">
                  Open my dashboard
                </Link>
              ) : (
                <>
                  <Link className="btn btn-primary" to="/register">
                    Create an account
                  </Link>
                  <Link className="btn btn-secondary" to="/login">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
