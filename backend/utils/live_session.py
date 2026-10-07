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
        if len(results) < 10:
            return None

        tp = fp = fn = tn = 0
        for result in results:
            signals = result["live_signals"] or {}
            temporal_cue = bool(signals.get("eye_closure") or signals.get("yawn"))
            model_vote = bool(signals.get("model_consensus", result["votes"] >= 2))
            if model_vote and temporal_cue:
                tp += 1
            elif not model_vote and temporal_cue:
                fn += 1
            elif not model_vote and result["ae_error"] > 0.9:
                fp += 1
            elif not model_vote and result["ae_error"] <= 0.6:
                tn += 1

        assessed = tp + fp + fn + tn
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        accuracy = (tp + tn) / len(results) if results else 0.0
        with self._lock:
            self.true_positives = tp
            self.false_positives = fp
            self.false_negatives = fn
            self.true_negatives = tn
        roc = self.compute_live_roc()
        return {
            "f1_score": round(f1, 3),
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "accuracy": round(accuracy, 3),
            "roc_auc": roc["auc"] if roc else None,
            "avg_ae_error": round(sum(row["ae_error"] for row in results) / len(results), 3),
            "avg_if_score": round(sum(row["if_score"] for row in results) / len(results), 3),
            "avg_lof_score": round(sum(row["lof_score"] for row in results) / len(results), 3),
            "total_frames": len(results),
            "drowsy_frames": sum(row["is_drowsy"] for row in results),
            "alert_frames": sum(not row["is_drowsy"] for row in results),
            "confusion": {
                "true_positive": tp,
                "false_positive": fp,
                "false_negative": fn,
                "true_negative": tn,
            },
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
