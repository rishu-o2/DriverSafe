from collections import deque
from datetime import datetime
from threading import Lock
from time import monotonic


_lock = Lock()
_features = deque(maxlen=300)
_total_frames = 0
_face_frames = 0
_alert_frames = 0
_session_started_at = datetime.now()
_session_started_clock = monotonic()


def record_frame(features=None, is_alert=False):
    global _total_frames, _face_frames, _alert_frames
    with _lock:
        _total_frames += 1
        if features is not None:
            _face_frames += 1
            _features.append(features.tolist())
        if is_alert:
            _alert_frames += 1


def get_features():
    with _lock:
        return list(_features)


def get_stats():
    with _lock:
        return {
            "total_frames": _total_frames,
            "alert_frames": _alert_frames,
            "face_frames": _face_frames,
            "session_started_at": _session_started_at.isoformat(),
            "session_seconds": monotonic() - _session_started_clock,
        }
