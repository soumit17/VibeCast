"""Real track playback via Deezer's free, unauthenticated public API (spec §7a).

Also used to build the personal app's taste-based playlist: real tracks pulled
from a user's connected top artists, not song titles invented by an LLM.
"""

import httpx

DEEZER_SEARCH_URL = "https://api.deezer.com/search"
DEEZER_SEARCH_ARTIST_URL = "https://api.deezer.com/search/artist"
DEEZER_ARTIST_TOP_URL = "https://api.deezer.com/artist/{artist_id}/top"


async def search_track(title: str, artist: str) -> dict | None:
    """Return {preview_url, cover_url} for the best match, or None if no match/on error.

    Deezer needs no API key. If it has no match, callers should leave the track's
    preview/cover fields null rather than failing the request (spec §7a).
    """
    query = f"{title} {artist}".strip()
    if not query:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(DEEZER_SEARCH_URL, params={"q": query})
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    tracks = data.get("data") or []
    if not tracks:
        return None
    top = tracks[0]
    return {
        "preview_url": top.get("preview") or None,
        "cover_url": (top.get("album") or {}).get("cover_medium") or None,
        "matched_title": top.get("title"),
        "matched_artist": (top.get("artist") or {}).get("name"),
    }


async def get_artist_top_tracks(artist_name: str, limit: int = 5) -> list[dict]:
    """Return up to `limit` real tracks {title, artist, preview_url, cover_url}
    for the given artist name, via Deezer's artist search + top-tracks endpoints.
    Returns an empty list on no match or any error — callers should skip the
    artist rather than fail the whole playlist."""
    if not artist_name.strip():
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            search_resp = await client.get(DEEZER_SEARCH_ARTIST_URL, params={"q": artist_name, "limit": 1})
            search_resp.raise_for_status()
            search_data = search_resp.json()
            artists = search_data.get("data") or []
            if not artists:
                return []
            artist_id = artists[0].get("id")
            if artist_id is None:
                return []

            top_resp = await client.get(DEEZER_ARTIST_TOP_URL.format(artist_id=artist_id), params={"limit": limit})
            top_resp.raise_for_status()
            top_data = top_resp.json()
    except (httpx.HTTPError, ValueError):
        return []

    tracks = top_data.get("data") or []
    results = []
    for t in tracks:
        preview = t.get("preview")
        if not preview:
            continue
        results.append(
            {
                "title": t.get("title"),
                "artist": (t.get("artist") or {}).get("name") or artist_name,
                "preview_url": preview,
                "cover_url": (t.get("album") or {}).get("cover_medium"),
            }
        )
    return results
