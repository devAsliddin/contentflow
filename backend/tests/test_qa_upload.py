"""QA — media upload content validation (magic-byte sniffing)."""
import pytest

from app.routers.upload import _validate_magic, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES


JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 8
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 8
MOV = b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 8


@pytest.mark.parametrize("content,ctype,ok", [
    pytest.param(JPEG, "image/jpeg", True, id="valid-jpeg"),
    pytest.param(PNG, "image/png", True, id="valid-png"),
    pytest.param(WEBP, "image/webp", True, id="valid-webp"),
    pytest.param(MP4, "video/mp4", True, id="valid-mp4"),
    pytest.param(MOV, "video/quicktime", True, id="valid-mov"),
    pytest.param(PNG, "image/jpeg", False, id="png-bytes-claiming-jpeg"),
    pytest.param(b"<html></html>", "image/png", False, id="html-claiming-png"),
    pytest.param(b"GIF89a" + b"\x00" * 16, "image/gif", False, id="unsupported-gif"),
    pytest.param(b"short", "image/jpeg", False, id="too-short"),
])
def test_validate_magic(content, ctype, ok):
    assert _validate_magic(content, ctype) is ok


def test_allowed_types_are_locked_down():
    """Only the expected, safe content types are accepted."""
    assert ALLOWED_IMAGE_TYPES == {"image/jpeg", "image/png", "image/webp"}
    assert ALLOWED_VIDEO_TYPES == {"video/mp4", "video/quicktime"}
