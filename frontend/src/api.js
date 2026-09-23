const TOKEN_KEY = "vibecast_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage failures (private browsing etc.)
  }
}

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = "GET", body, auth = false, params } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let url = path;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // no JSON body
    }
    throw new ApiError(detail, res.status, detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (email, password, display_name) =>
    request("/api/auth/register", { method: "POST", body: { email, password, display_name } }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/api/auth/me", { auth: true }),
  connectMusic: () => request("/api/auth/connect-music", { method: "POST", auth: true }),

  createVenue: (name, address) => request("/api/venues", { method: "POST", auth: true, body: { name, address } }),
  listVenues: () => request("/api/venues", { auth: true }),
  getVenue: (venueId) => request(`/api/venues/${venueId}`),

  createRoom: (venueId, name) =>
    request(`/api/venues/${venueId}/rooms`, { method: "POST", auth: true, body: { name } }),
  listRooms: (venueId) => request(`/api/venues/${venueId}/rooms`, { auth: true }),
  getRoom: (roomId) => request(`/api/rooms/${roomId}`),
  getRoomQr: (roomId) => request(`/api/rooms/${roomId}/qr`),
  crowdScan: (roomId, demoIndex) =>
    request(`/api/rooms/${roomId}/crowd-scan`, { method: "POST", params: { demo_index: demoIndex } }),

  joinRoom: (roomId, display_name, connect_music, useAuth) =>
    request(`/api/rooms/${roomId}/join`, {
      method: "POST",
      auth: !!useAuth,
      body: { display_name, connect_music },
    }),
  listGuests: (roomId) => request(`/api/rooms/${roomId}/guests`),
  tasteBlend: (roomId) => request(`/api/rooms/${roomId}/taste-blend`),

  addTrack: (roomId, title, artist, requested_by) =>
    request(`/api/rooms/${roomId}/queue`, { method: "POST", body: { title, artist, requested_by } }),
  getQueue: (roomId) => request(`/api/rooms/${roomId}/queue`),
  voteTrack: (roomId, trackId) =>
    request(`/api/rooms/${roomId}/queue/vote`, { method: "POST", body: { track_id: trackId } }),
  bidTrack: (roomId, trackId, amount) =>
    request(`/api/rooms/${roomId}/queue/bid`, { method: "POST", body: { track_id: trackId, amount } }),
  markPlayed: (roomId, trackId) => request(`/api/rooms/${roomId}/queue/${trackId}/played`, { method: "POST" }),

  djSuggest: (roomId) => request(`/api/rooms/${roomId}/dj/suggest`, { method: "POST", auth: true }),

  mood: (payload) => request("/api/me/mood", { method: "POST", body: payload }),
  getPlaylist: () => request("/api/me/playlist", { auth: true }),
};

export function roomSocketUrl(roomId) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/rooms/${roomId}/live`;
}

export { ApiError };
