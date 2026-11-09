from typing import Any, Dict
from datetime import datetime

from database import Alert, SessionLocal


class AlertLogger:
    def log_alert(self, user_id: int, frame: int, state: str, scores: Dict[str, Any]) -> None:
        with SessionLocal() as db:
            alert = Alert(
                user_id=user_id,
                frame=frame,
                state=state,
                ae_error=float(scores.get("ae_error", 0.0) or 0.0),
                if_score=float(scores.get("if_score", 0.0) or 0.0),
                lof=float(scores.get("lof_score", scores.get("lof", 0.0)) or 0.0),
                confidence=float(scores.get("confidence", 1.0) or 0.0),
                models=scores.get("models", ["AE", "IF", "LOF"]),
                votes=int(scores.get("votes", 0) or 0),
                model_alerts=scores.get("model_alerts", {}) or {},
                live_signals=scores.get("live_signals", {}) or {},
            )
            db.add(alert)
            db.commit()

    def start_episode(self, user_id: int, frame: int, scores: Dict[str, Any], started_at: datetime, peak_severity: float) -> int:
        with SessionLocal() as db:
            alert = Alert(
                user_id=user_id,
                frame=frame,
                state="DROWSY",
                timestamp=started_at,
                end_timestamp=None,
                peak_severity=float(peak_severity),
                ae_error=float(scores.get("ae_error", 0.0) or 0.0),
                if_score=float(scores.get("if_score", 0.0) or 0.0),
                lof=float(scores.get("lof_score", scores.get("lof", 0.0)) or 0.0),
                confidence=float(scores.get("confidence", 0.0) or 0.0),
                models=scores.get("models", []),
                votes=int(scores.get("votes", 0) or 0),
                model_alerts=scores.get("model_alerts", {}) or {},
                live_signals=scores.get("live_signals", {}) or {},
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            return alert.id

    def finish_episode(self, episode_id: int, ended_at: datetime, peak_severity: float) -> None:
        with SessionLocal() as db:
            alert = db.query(Alert).filter(Alert.id == episode_id).first()
            if alert is None:
                return
            alert.end_timestamp = ended_at
            alert.peak_severity = float(peak_severity)
            db.commit()
