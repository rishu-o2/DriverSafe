from collections import deque
from datetime import datetime
from threading import Lock
from time import monotonic, time


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
            "f1_score": None,
            "precision": None,
            "recall": None,
            "accuracy": None,
            "roc_auc": None,
            "confusion": None,
            "avg_ae_error": average("ae_error"),
            "avg_if_score": average("if_score"),
            "avg_lof_score": average("lof_score"),
            "total_frames": len(results),
            "face_frames": len(face_results),
            "drowsy_frames": sum(row["is_drowsy"] for row in results),
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
            return {
                "fpr": [round(float(value), 3) for value in fpr],
                "tpr": [round(float(value), 3) for value in tpr],
                "auc": round(float(roc_auc_score(labels, scores)), 3),
            }
        except (ValueError, ImportError):
            return None

    def get_live_ae_timeline(self):
        with self._lock:
            results = list(self.recent_results)[-50:]
        return [
            {"frame": result["frame"], "error": result["ae_error"], "threshold": result["ae_threshold"], "is_drowsy": result["is_drowsy"]}
            for result in results
        ]

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


_session = LiveSession()


def get_session() -> LiveSession:
    return _session


def reset_session():
    global _session
    _session = LiveSession()


def record_frame(features=None, is_alert=False):
    _session.record_frame(features, is_alert)


def get_features():
    return _session.get_features()


def get_stats():
    return _session.get_stats()
