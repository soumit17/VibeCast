import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import PersonalDashboard from "./pages/PersonalDashboard";
import VenuesList from "./pages/VenuesList";
import VenueDashboard from "./pages/VenueDashboard";
import GuestJoin from "./pages/GuestJoin";

function Nav() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container">
      <nav className="nav">
        <Link className="nav-brand" to="/">
          <span className="dot" />
          Soundtrack
        </Link>
        <div className="nav-links">
          {!loading && user ? (
            <>
              <Link className="btn btn-ghost btn-sm" to="/me">
                Personal
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/venues">
                Venues
              </Link>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link className="btn btn-ghost btn-sm" to="/me">
                  Try it
                </Link>
                <Link className="btn btn-secondary btn-sm" to="/login">
                  Log in
                </Link>
                <Link className="btn btn-primary btn-sm" to="/register">
                  Sign up
                </Link>
              </>
            )
          )}
        </div>
      </nav>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="center-page">
        <span className="spinner" />
      </div>
    );
  }
  if (!user) return <Login />;
  return children;
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/me" element={<PersonalDashboard />} />
        <Route
          path="/venues"
          element={
            <RequireAuth>
              <VenuesList />
            </RequireAuth>
          }
        />
        <Route
          path="/venues/:venueId"
          element={
            <RequireAuth>
              <VenueDashboard />
            </RequireAuth>
          }
        />
        <Route path="/join/:roomId" element={<GuestJoin />} />
      </Routes>
      <footer className="footer">
        <div className="container">One taste graph, two contexts. Built for a single night on one EC2 box.</div>
      </footer>
    </>
  );
}
