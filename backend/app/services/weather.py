"""Real weather context via Open-Meteo (free, no API key required)."""

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_weather(lat: float, lon: float) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                OPEN_METEO_URL,
                params={"latitude": lat, "longitude": lon, "current": "temperature_2m,weather_code,is_day"},
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    current = data.get("current") or {}
    if not current:
        return None
    return {
        "temperature_c": current.get("temperature_2m"),
        "weather_code": current.get("weather_code"),
        "is_day": bool(current.get("is_day")),
    }
