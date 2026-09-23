import base64
from io import BytesIO

import qrcode

from app.config import settings


def build_join_url(room_id: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/join/{room_id}"


def generate_qr_png_base64(url: str) -> str:
    img = qrcode.make(url)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")
