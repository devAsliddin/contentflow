"""Timezone helpers — the app's users are in Tashkent (UTC+5, no DST).

Consistent model across the backend:
- The DB stores tz-aware datetimes in UTC.
- Celery ETAs / scheduling run in UTC.
- Anything a user (or the LLM) TYPES, or that is DISPLAYED to the user, is
  interpreted/shown in Tashkent local time (UTC+5).

Uzbekistan is UTC+5 year-round (no DST), so a fixed offset is correct and
avoids a tzdata dependency on Windows.
"""
from datetime import datetime, timedelta, timezone

LOCAL_TZ = timezone(timedelta(hours=5), "Asia/Tashkent")


def parse_local_to_utc(value: str | None) -> datetime | None:
    """Parse an ISO datetime written in LOCAL time and return aware UTC.

    A naive value is interpreted as Tashkent local; an explicit offset is
    honoured. Returns None on missing/invalid input.
    """
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=LOCAL_TZ)
    return dt.astimezone(timezone.utc)


def to_local(dt: datetime | None) -> datetime | None:
    """Convert a DB datetime to Tashkent local time.

    Naive values are assumed to be UTC (legacy rows). Returns None for None.
    Use whenever an aggregation/display derives an hour-of-day or weekday that
    the user reads as a local clock time.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ)
