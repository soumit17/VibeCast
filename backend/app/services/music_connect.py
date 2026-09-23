"""Simulated Spotify/Apple Music "connect your library" (spec §3).

Real OAuth needs app review + secrets not available at hackathon speed. This
returns a canned but plausible top-artists/genres list, shaped exactly like a
real OAuth-backed call would return, so swapping the body later doesn't
require touching any caller. # TODO: replace with real Spotify/Apple Music OAuth
"""

import random

_TASTE_PROFILES = [
    {
        "top_artists": ["Fred again..", "Overmono", "Bicep", "Jamie xx", "Four Tet"],
        "top_genres": ["UK garage", "electronic", "house", "bass"],
    },
    {
        "top_artists": ["Tyler, The Creator", "Kendrick Lamar", "Doechii", "JID", "Denzel Curry"],
        "top_genres": ["hip hop", "rap", "neo-soul"],
    },
    {
        "top_artists": ["The Strokes", "Fontaines D.C.", "IDLES", "Turnstile", "Wet Leg"],
        "top_genres": ["indie rock", "post-punk", "alternative"],
    },
    {
        "top_artists": ["Peggy Gou", "Disclosure", "Honey Dijon", "Black Coffee", "Four Tet"],
        "top_genres": ["house", "afro house", "electronic", "dance"],
    },
    {
        "top_artists": ["Beyonce", "Dua Lipa", "The Weeknd", "SZA", "Rosalia"],
        "top_genres": ["pop", "r&b", "dance pop"],
    },
    {
        "top_artists": ["Bad Bunny", "Karol G", "Rauw Alejandro", "Feid"],
        "top_genres": ["reggaeton", "latin", "latin trap"],
    },
]


def connect_music_library(user_id: str) -> dict:
    """Return {top_artists, top_genres} for the given user. Deterministic-ish
    per call (random pick) since there's no real account to read from yet."""
    profile = random.choice(_TASTE_PROFILES)
    return {"top_artists": list(profile["top_artists"]), "top_genres": list(profile["top_genres"])}
