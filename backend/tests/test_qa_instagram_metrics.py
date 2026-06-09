"""QA — Instagram publishing placement routing + real engagement metrics."""
import pytest
from unittest.mock import MagicMock, patch

import app.services.instagram_service as ig_service
from app.services.instagram_service import post_to_instagram_session, fetch_media_metrics


def _img(tmp_path):
    p = tmp_path / "pic.jpg"
    p.write_bytes(b"\xff\xd8\xff\xe0" + b"0" * 64)
    return str(p)


def _vid(tmp_path):
    p = tmp_path / "clip.mp4"
    p.write_bytes(b"0000ftyp" + b"0" * 64)
    return str(p)


@pytest.mark.parametrize("placement,media_type,expected_method", [
    ("story", "image", "photo_upload_to_story"),
    ("feed",  "image", "photo_upload"),
    (None,    "image", "photo_upload"),
    ("story", "video", "video_upload_to_story"),
    ("feed",  "video", "video_upload"),
    ("reel",  "video", "clip_upload"),
    (None,    "video", "clip_upload"),
])
def test_placement_routes_to_correct_upload(tmp_path, placement, media_type, expected_method):
    """Story → story upload, Reel → clip, feed → feed — for both image and video."""
    cl = MagicMock()
    media = MagicMock(pk="media_pk_1")
    getattr(cl, expected_method).return_value = media
    path = _img(tmp_path) if media_type == "image" else _vid(tmp_path)

    with patch.object(ig_service, "_client", return_value=cl):
        result = post_to_instagram_session(
            session={"k": "v"},
            caption="hello",
            media_path=path,
            media_type=media_type,
            placement=placement,
        )

    assert result == "media_pk_1"
    getattr(cl, expected_method).assert_called_once()
    # No other upload method should have fired.
    for m in ("photo_upload", "photo_upload_to_story", "video_upload",
              "video_upload_to_story", "clip_upload"):
        if m != expected_method:
            getattr(cl, m).assert_not_called()


def test_expired_session_raises(tmp_path):
    """A dead session (get_timeline_feed throws) is reported as expired."""
    cl = MagicMock()
    cl.get_timeline_feed.side_effect = Exception("login_required")
    with patch.object(ig_service, "_client", return_value=cl):
        with pytest.raises(ValueError, match="session expired"):
            post_to_instagram_session({"k": "v"}, "c", _img(tmp_path), "image", "feed")


def test_fetch_media_metrics_returns_real_numbers():
    """fetch_media_metrics maps real like/view/comment counts per post."""
    cl = MagicMock()
    cl.media_info.return_value = MagicMock(
        like_count=1204, comment_count=48, view_count=8000, play_count=8000,
    )
    with patch.object(ig_service, "_client", return_value=cl):
        out = fetch_media_metrics([("post-1", "17900000000000000", {"sess": 1})])

    assert out["post-1"]["likes"] == 1204
    assert out["post-1"]["comments"] == 48
    assert out["post-1"]["views"] == 8000
    assert out["post-1"]["reach"] >= out["post-1"]["likes"]


def test_fetch_media_metrics_skips_failures_gracefully():
    """A single failing post must not break the whole batch."""
    cl = MagicMock()
    cl.media_info.side_effect = Exception("rate limited")
    with patch.object(ig_service, "_client", return_value=cl):
        out = fetch_media_metrics([("post-x", "123", {"sess": 1})])
    assert out == {}


def test_fetch_media_metrics_reuses_client_per_session():
    """Posts sharing a session reuse one instagrapi client (fewer API logins)."""
    cl = MagicMock()
    cl.media_info.return_value = MagicMock(like_count=1, comment_count=0, view_count=0, play_count=0)
    session = {"shared": True}
    with patch.object(ig_service, "_client", return_value=cl) as factory:
        fetch_media_metrics([
            ("p1", "111", session),
            ("p2", "222", session),
        ])
    assert factory.call_count == 1  # one client for the shared session
    assert cl.media_info.call_count == 2
