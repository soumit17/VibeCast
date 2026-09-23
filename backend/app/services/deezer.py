"""Real track playback via Deezer's free, unauthenticated public API (spec §7a)."""

import httpx

DEEZER_SEARCH_URL = "https://api.deezer.com/search"


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
