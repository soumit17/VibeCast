"""Bidding has real ranking logic but fake payment (spec §3/§4): the bid amount
is stored and affects queue ranking; no money actually moves.
# TODO: real payment processor (Stripe)
"""


def process_payment(amount: float) -> bool:
    """Always succeeds. Swap this body for a real Stripe PaymentIntent later;
    callers only care about the bool result."""
    return True
