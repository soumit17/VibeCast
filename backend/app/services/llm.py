"""The two real LLM calls (spec §7, §8): the DJ engine and the personal-app
mood fusion layer. Both are single well-constructed prompts, not trained
models. Both fall back gracefully instead of crashing the demo when the API
key is missing or the call fails.
"""

import json
import logging

from anthropic import Anthropic, AnthropicError

from app.config import settings

logger = logging.getLogger("vibecast.llm")

MODEL = "claude-sonnet-4-5"

_client: Anthropic | None = None


def _get_client() -> Anthropic | None:
    global _client
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    # Model occasionally wraps JSON in a fence despite instructions; salvage it.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except ValueError:
            return None
    return None


async def dj_suggest(
    taste_blend: list[dict],
    crowd_snapshot: dict,
    recent_tracks: list[dict],
    queue_candidates: list[dict],
) -> dict:
    """Returns {suggested_track, suggested_artist, reasoning, target_energy, target_valence}."""
    client = _get_client()
    fallback = _dj_fallback(queue_candidates)
    if client is None:
        return fallback

    prompt = f"""You are a DJ reading the room at a live venue. Given this taste blend and this crowd
reading, suggest the next track and explain your reasoning in one sentence a venue dashboard
could display to staff.

Blended guest taste (genre: guest count): {json.dumps(taste_blend)}
Crowd snapshot: {json.dumps(crowd_snapshot)}
Last 5 played tracks (avoid repeating these): {json.dumps(recent_tracks)}
Current top-of-queue candidates you may pick from, or suggest something else entirely: {json.dumps(queue_candidates)}

Respond only with JSON, no preamble, matching exactly this shape:
{{"suggested_track": string, "suggested_artist": string, "reasoning": string, "target_energy": number between 0 and 1, "target_valence": number between 0 and 1}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system="Respond only with JSON, no preamble, no markdown fences.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        parsed = _extract_json(text)
        if parsed is None:
            logger.warning("DJ engine: could not parse JSON from model output")
            return fallback
        return {
            "suggested_track": str(parsed.get("suggested_track", fallback["suggested_track"])),
            "suggested_artist": str(parsed.get("suggested_artist", fallback["suggested_artist"])),
            "reasoning": str(parsed.get("reasoning", fallback["reasoning"])),
            "target_energy": float(parsed.get("target_energy", fallback["target_energy"])),
            "target_valence": float(parsed.get("target_valence", fallback["target_valence"])),
        }
    except (AnthropicError, ValueError, TypeError) as exc:
        logger.warning("DJ engine LLM call failed, falling back: %s", exc)
        return fallback


def _dj_fallback(queue_candidates: list[dict]) -> dict:
    """No API key or call failed: pick the highest-voted queued track, no reasoning text."""
    if queue_candidates:
        top = max(queue_candidates, key=lambda t: t.get("score", t.get("vote_count", 0)))
        return {
            "suggested_track": top.get("title", "Unknown"),
            "suggested_artist": top.get("artist", "Unknown"),
            "reasoning": "",
            "target_energy": 0.5,
            "target_valence": 0.5,
        }
    return {
        "suggested_track": "",
        "suggested_artist": "",
        "reasoning": "",
        "target_energy": 0.5,
        "target_valence": 0.5,
    }


async def fuse_mood(
    mic_energy: float,
    camera_frame_base64: str | None,
    weather: dict | None,
    taste_history: dict | None,
) -> dict:
    """Returns {valence, energy, tempo, summary}. Uses a vision-capable call when a
    camera frame is provided, since the fusion combines mic + camera + context."""
    client = _get_client()
    fallback = _mood_fallback(mic_energy)
    if client is None:
        return fallback

    context_text = f"""Fuse this context into structured mood parameters for an ambient audio
generator. If a camera frame is attached, read the mood/energy of the scene from it.

Mic energy reading (0=silence, 1=loud): {mic_energy}
Weather: {json.dumps(weather) if weather else "unknown"}
Saved taste history (top genres): {json.dumps((taste_history or {}).get("top_genres", []))}

Respond only with JSON, no preamble, matching exactly this shape:
{{"valence": number between 0 and 1, "energy": number between 0 and 1, "tempo": number of BPM between 60 and 160, "summary": short one-sentence description of the mood}}"""

    content: list[dict] = [{"type": "text", "text": context_text}]
    if camera_frame_base64:
        content.insert(
            0,
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": camera_frame_base64},
            },
        )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=300,
            system="Respond only with JSON, no preamble, no markdown fences.",
            messages=[{"role": "user", "content": content}],
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        parsed = _extract_json(text)
        if parsed is None:
            logger.warning("Mood fusion: could not parse JSON from model output")
            return fallback
        return {
            "valence": float(parsed.get("valence", fallback["valence"])),
            "energy": float(parsed.get("energy", fallback["energy"])),
            "tempo": float(parsed.get("tempo", fallback["tempo"])),
            "summary": str(parsed.get("summary", fallback["summary"])),
        }
    except (AnthropicError, ValueError, TypeError) as exc:
        logger.warning("Mood fusion LLM call failed, falling back: %s", exc)
        return fallback


def _mood_fallback(mic_energy: float) -> dict:
    """No API key or call failed: default mid-energy mood derived from mic reading alone."""
    energy = max(0.0, min(1.0, mic_energy)) if mic_energy else 0.4
    return {
        "valence": 0.5,
        "energy": energy,
        "tempo": 80 + energy * 60,
        "summary": "steady, mid-energy ambience",
    }
