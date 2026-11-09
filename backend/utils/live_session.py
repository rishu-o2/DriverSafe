"""In-process live state keyed by authenticated user, for a single backend instance."""

from collections import OrderedDict, deque
from datetime import datetime, timezone
from threading import Lock
from time import monotonic, time

import numpy as np


SESSION_TTL_SECONDS = 30 * 60
DISCONNECT_GRACE_SECONDS = 30
MAX_USER_SESSIONS = 1000
MIN_CALIBRATION_FRAMES = 100


class LiveSession:
    def __init__(self):
        self._lock = Lock()
        self.feature_deque = deque(maxlen=300)
        self.recent_results = deque(maxlen=100)
        self.true_positives = 0
        self.false_positives = 0
        self.false_negatives = 0
        self.true_negatives = 0
        self.total_predictions = 0
        self.correct_predictions = 0
        self.total_frames = 0
        self.face_frames = 0
        self.alert_frames = 0
        self.session_started_at = datetime.now()
        self.session_started_clock = monotonic()
        self.calibration_last_frame_clock = None
        self.calibration_valid_seconds = 0.0
        self.calibration_samples = deque(maxlen=3000)
        self.calibration_baseline = None
        self.detector_tracker = None
        self.active_episode = None
        self.last_alert_event_clock = None
        self.disconnected_at_clock = None

    def _calibration_state_locked(self, duration_seconds):
        if self.calibration_baseline is not None:
            return {"phase": "active", "progress": 1.0}

        if (
            self.calibration_valid_seconds >= duration_seconds
            and len(self.calibration_samples) >= MIN_CALIBRATION_FRAMES
        ):
            matrix = np.asarray(self.calibration_samples, dtype=np.float64)
            self.calibration_baseline = {
                "mean": matrix.mean(axis=0).tolist(),
                "std": matrix.std(axis=0).tolist(),
                "sample_count": len(matrix),
            }
            return {"phase": "active", "progress": 1.0}

        time_progress = self.calibration_valid_seconds / duration_seconds if duration_seconds > 0 else 0.0
        sample_progress = len(self.calibration_samples) / MIN_CALIBRATION_FRAMES
        progress = min(time_progress, sample_progress, 0.99)
        return {"phase": "calibrating", "progress": round(progress, 3)}

    def _is_extreme_calibration_frame_locked(self, values):
        if len(values) != 20 or not np.isfinite(values).all():
            return True
        if np.any(values < 0.0) or np.any(values > 1.0):
            return True
        # Do not learn a resting baseline from closed eyes or a wide-open mouth.
        if min(float(values[14]), float(values[15])) < 0.35:
            return True
        if max(float(values[3]), float(values[13])) > 0.85:
            return True

        if len(self.calibration_samples) >= 10:
            matrix = np.asarray(self.calibration_samples, dtype=np.float64)
            for index in (14, 15, 3, 6, 7, 8, 19):
                mean = float(matrix[:, index].mean())
                std = float(matrix[:, index].std())
                if abs(float(values[index]) - mean) > max(4.0 * std, 0.2):
                    return True
        return False

    def observe_calibration_frame(self, features, duration_seconds):
        values = np.asarray(features, dtype=np.float64)
        with self._lock:
            if self.calibration_baseline is None and not self._is_extreme_calibration_frame_locked(values):
                now = monotonic()
                if self.calibration_last_frame_clock is not None:
                    frame_gap = now - self.calibration_last_frame_clock
                    if 0.0 < frame_gap <= 5.0:
                        self.calibration_valid_seconds += min(frame_gap, 1.0)
                self.calibration_last_frame_clock = now
                self.calibration_samples.append(values.tolist())
            elif self.calibration_baseline is None:
                self.calibration_last_frame_clock = None
            return self._calibration_state_locked(duration_seconds)

    def note_calibration_gap(self):
        with self._lock:
            if self.calibration_baseline is None:
                self.calibration_last_frame_clock = None

    def get_calibration_state(self, duration_seconds):
        with self._lock:
            return self._calibration_state_locked(duration_seconds)

    def get_calibration_baseline(self):
        with self._lock:
            return self.calibration_baseline

    def get_or_create_detector_tracker(self, factory):
        """Keep temporal detector state across reconnects for this user session."""
        with self._lock:
            if self.detector_tracker is None:
                self.detector_tracker = factory()
            return self.detector_tracker

    def mark_connected(self):
        with self._lock:
            self.disconnected_at_clock = None

    def mark_disconnected(self):
        with self._lock:
            self.disconnected_at_clock = monotonic()

    def close_episode_after_disconnect(self, grace_seconds):
        with self._lock:
            disconnected_at = self.disconnected_at_clock
            if disconnected_at is None or monotonic() - disconnected_at < grace_seconds:
                return None
            return self._close_open_episode_locked()

    def close_open_episode(self):
        with self._lock:
            return self._close_open_episode_locked()

    def _close_open_episode_locked(self):
        if self.active_episode is None:
            return None
        self.active_episode["end_timestamp"] = datetime.now(timezone.utc)
        episode = {"action": "ended", **self.active_episode}
        self.active_episode = None
        return episode

    def update_episode(self, is_drowsy, severity, cooldown_seconds, frame=None, scores=None):
        now_clock = monotonic()
        now = datetime.now(timezone.utc)
        with self._lock:
            if is_drowsy:
                if self.active_episode is not None:
                    self.active_episode["end_timestamp"] = now
                    self.active_episode["peak_severity"] = max(
                        self.active_episode["peak_severity"], float(severity or 0.0)
                    )
                    return None

                alert_event = (
                    self.last_alert_event_clock is None
                    or now_clock - self.last_alert_event_clock >= cooldown_seconds
                )
                if alert_event:
                    self.last_alert_event_clock = now_clock
                episode_scores = scores or {}
                self.active_episode = {
                    "id": None,
                    "timestamp": now,
                    "end_timestamp": now,
                    "peak_severity": float(severity or 0.0),
                    "alert_event": alert_event,
                    "frame": frame,
                    "scores": {
                        key: episode_scores.get(key)
                        for key in (
                            "ae_error", "if_score", "lof_score", "confidence", "models",
                            "votes", "model_alerts", "live_signals",
                        )
                    },
                }
                event = {"action": "started", **self.active_episode}
                event["end_timestamp"] = None
                return event

            if self.active_episode is None:
                return None
            return self._close_open_episode_locked()

    def set_active_episode_id(self, episode_id):
        with self._lock:
            if self.active_episode is not None:
                self.active_episode["id"] = episode_id

    def record_frame(self, features=None, is_alert=False):
        with self._lock:
            self.total_frames += 1
            if features is not None:
                self.face_frames += 1
                values = features.tolist() if hasattr(features, "tolist") else list(features)
                self.feature_deque.append(values)
            if is_alert:
                self.alert_frames += 1

    def record_frame_result(self, result: dict):
        with self._lock:
            signals = result.get("live_signals", {}) or {}
            proxy_truth = bool(signals.get("eye_closure") or signals.get("yawn"))
            self.correct_predictions += int(bool(result.get("is_drowsy", False)) == proxy_truth)
            self.recent_results.append({
                "frame": result.get("frame", self.total_predictions + 1),
                "is_drowsy": bool(result.get("is_drowsy", False)),
                "face_detected": bool(result.get("face_detected", False)),
                "ae_error": float(result.get("ae_error", 0) or 0),
                "ae_threshold": float(result.get("ae_threshold", 0.75) or 0.75),
                "if_score": float(result.get("if_score", 0) or 0),
                "lof_score": float(result.get("lof_score", 0) or 0),
                "votes": int(result.get("votes", 0) or 0),
                "live_signals": result.get("live_signals", {}),
                "timestamp": time(),
            })
            self.total_predictions += 1

    def compute_live_metrics(self):
        with self._lock:
            results = list(self.recent_results)
            total_frames = self.total_predictions
        if not results:
            return None
        face_results = [row for row in results if row.get("face_detected", True)]
        average = lambda key: round(sum(row[key] for row in face_results) / len(face_results), 3) if face_results else None
        return {
            "f1_score": None, "precision": None, "recall": None, "accuracy": None,
            "roc_auc": None, "confusion": None,
            "avg_ae_error": average("ae_error"), "avg_if_score": average("if_score"),
            "avg_lof_score": average("lof_score"), "total_frames": len(results),
            "face_frames": len(face_results), "drowsy_frames": sum(row["is_drowsy"] for row in results),
            "alert_frames": sum(row["is_drowsy"] for row in results),
            "eye_closure_frames": sum(bool((row.get("live_signals") or {}).get("eye_closure")) for row in results),
            "yawn_frames": sum(bool((row.get("live_signals") or {}).get("yawn")) for row in results),
            "model_consensus_frames": sum(bool((row.get("live_signals") or {}).get("model_consensus")) for row in results),
            "model_consensus_rate": round(sum(bool((row.get("live_signals") or {}).get("model_consensus")) for row in results) / len(results), 3),
            "session_frames": total_frames,
        }

    def compute_live_roc(self):
        with self._lock:
            results = list(self.recent_results)
        if len(results) < 20:
            return None
        labels = [int(result["is_drowsy"]) for result in results]
        if not any(labels) or all(labels):
            return None
        try:
            from sklearn.metrics import roc_auc_score, roc_curve
            scores = [result["ae_error"] for result in results]
            fpr, tpr, _ = roc_curve(labels, scores)
            return {"fpr": [round(float(value), 3) for value in fpr], "tpr": [round(float(value), 3) for value in tpr], "auc": round(float(roc_auc_score(labels, scores)), 3)}
        except (ValueError, ImportError):
            return None

    def get_live_ae_timeline(self):
        with self._lock:
            results = list(self.recent_results)[-50:]
        return [{"frame": result["frame"], "error": result["ae_error"], "threshold": result["ae_threshold"], "is_drowsy": result["is_drowsy"]} for result in results]

    def get_features(self):
        with self._lock:
            return list(self.feature_deque)

    def get_stats(self):
        with self._lock:
            return {
                "total_frames": self.total_frames,
                "alert_frames": self.alert_frames,
                "face_frames": self.face_frames,
                "session_started_at": self.session_started_at.isoformat(),
                "session_seconds": monotonic() - self.session_started_clock,
            }


_sessions: OrderedDict[int, tuple[LiveSession, float]] = OrderedDict()
_sessions_lock = Lock()
_session_expiry_handler = None


def set_session_expiry_handler(handler) -> None:
    global _session_expiry_handler
    _session_expiry_handler = handler


def _remove_expired_sessions(now: float):
    expired_user_ids = [
        user_id for user_id, (_, last_seen) in _sessions.items()
        if now - last_seen >= SESSION_TTL_SECONDS
    ]
    expired = []
    for user_id in expired_user_ids:
        entry = _sessions.pop(user_id, None)
        if entry is not None:
            expired.append((user_id, entry[0]))
    return expired


def get_session(user_id: int | None = None, session_id: str | None = None) -> LiveSession:
    """Return the live session for one user; session_id remains accepted for compatibility."""
    if user_id is None:
        # A caller without an authenticated user gets isolated, non-shared state.
        return LiveSession()

    now = monotonic()
    expired = []
    with _sessions_lock:
        expired = _remove_expired_sessions(now)
        entry = _sessions.get(int(user_id))
        if entry is None:
            entry = (LiveSession(), now)
        else:
            entry = (entry[0], now)
        _sessions[int(user_id)] = entry
        _sessions.move_to_end(int(user_id))
        while len(_sessions) > MAX_USER_SESSIONS:
            expired_user_id, (expired_session, _) = _sessions.popitem(last=False)
            expired.append((expired_user_id, expired_session))

    if _session_expiry_handler is not None:
        for expired_user_id, expired_session in expired:
            _session_expiry_handler(expired_user_id, expired_session)
    return entry[0]


def reset_session(user_id: int | None = None, session_id: str | None = None) -> None:
    """Reset one user's state; session_id remains accepted for compatibility."""
    if user_id is None:
        return
    with _sessions_lock:
        _sessions[int(user_id)] = (LiveSession(), monotonic())
        _sessions.move_to_end(int(user_id))


def record_frame(features=None, is_alert=False, user_id=None, session_id=None):
    if user_id is not None:
        get_session(user_id).record_frame(features, is_alert)


def get_features(user_id=None, session_id=None):
    return get_session(user_id).get_features() if user_id is not None else []


def get_stats(user_id=None, session_id=None):
    if user_id is None:
        return {"total_frames": 0, "alert_frames": 0, "face_frames": 0, "session_started_at": None, "session_seconds": 0}
    return get_session(user_id).get_stats()
