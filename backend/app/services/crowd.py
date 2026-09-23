"""Simulated camera-based crowd analysis (spec §3).

Returns randomized but structurally realistic JSON matching what a real CV
pipeline (lightweight pose/age-estimation model) would output.
# TODO: replace with a real camera + pose/age-estimation pipeline
"""

import random

# Spec §9.3: a "demo mode" narrative arc a venue dashboard can cycle through
# on a timer instead of a pure random read, so a live demo has visible progression.
DEMO_SCENARIOS = [
    {
        "label": "quiet early evening",
        "headcount": (5, 20),
        "families_pct": (30, 50),
        "young_adults_pct": (20, 35),
        "want_to_dance_pct": (5, 15),
        "energy_level": (0.1, 0.3),
    },
    {
        "label": "filling up",
        "headcount": (20, 60),
        "families_pct": (10, 25),
        "young_adults_pct": (40, 60),
        "want_to_dance_pct": (20, 40),
        "energy_level": (0.35, 0.6),
    },
    {
        "label": "dance-floor energy",
        "headcount": (60, 150),
        "families_pct": (0, 10),
        "young_adults_pct": (60, 85),
        "want_to_dance_pct": (55, 85),
        "energy_level": (0.65, 0.95),
    },
]


def _rand_range(bounds: tuple[float, float]) -> float:
    return round(random.uniform(*bounds), 2)


def analyze_crowd(room_id: str, demo_index: int | None = None) -> dict:
    scenario = DEMO_SCENARIOS[demo_index % len(DEMO_SCENARIOS)] if demo_index is not None else random.choice(DEMO_SCENARIOS)

    headcount = random.randint(*scenario["headcount"])
    families_pct = _rand_range(scenario["families_pct"])
    young_adults_pct = _rand_range(scenario["young_adults_pct"])
    want_to_dance_pct = _rand_range(scenario["want_to_dance_pct"])
    energy_level = _rand_range(scenario["energy_level"])

    return {
        "scenario": scenario["label"],
        "headcount": headcount,
        "group_types": {
            "families_pct": families_pct,
            "young_adults_pct": young_adults_pct,
            "want_to_dance_pct": want_to_dance_pct,
        },
        "energy_level": energy_level,
    }
