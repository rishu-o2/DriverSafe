import csv
import io
from typing import Any, Dict

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from database import Alert, User, get_db
from routers.auth import get_current_user
from utils.live_session import get_session

router = APIRouter()


def _alert_dict(alert: Alert) -> Dict[str, Any]:
    return {
        "id": alert.id,
        "timestamp": alert.timestamp.isoformat(),
        "end_timestamp": alert.end_timestamp.isoformat() if alert.end_timestamp else None,
        "peak_severity": alert.peak_severity,
        "frame": alert.frame,
        "state": alert.state,
        "ae_error": alert.ae_error,
        "if_score": alert.if_score,
        "lof": alert.lof,
        "confidence": alert.confidence,
        "models": alert.models,
        "votes": alert.votes,
        "model_alerts": alert.model_alerts,
        "live_signals": alert.live_signals,
    }


@router.get("/history")
def get_alerts_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Dict[str, Any]:
    alerts = db.query(Alert).filter(Alert.user_id == user.id).order_by(Alert.timestamp.desc(), Alert.id.desc()).all()
    return {"total": len(alerts), "alerts": [_alert_dict(alert) for alert in alerts]}


@router.get("/stats")
def get_alerts_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Dict[str, Any]:
    alerts = db.query(Alert).filter(Alert.user_id == user.id).all()
    session = get_session(user.id).get_stats()
    frames = session["total_frames"]
    duration_minutes = session["session_seconds"] / 60
    return {
        "total_frames": frames,
        "alert_frames": len(alerts),
        "drowsy_alerts": sum(1 for alert in alerts if alert.state.lower() == "drowsy"),
        "yawn_alerts": sum(1 for alert in alerts if alert.state.lower() == "yawn"),
        "session_duration": f"{duration_minutes:.1f} min",
        "alert_rate": f"{(len(alerts) / max(frames, 1) * 100):.1f}%",
    }


@router.get("/export", response_class=PlainTextResponse)
def export_alerts_csv(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> str:
    alerts = db.query(Alert).filter(Alert.user_id == user.id).order_by(Alert.timestamp.desc(), Alert.id.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "timestamp", "end_timestamp", "peak_severity", "frame", "state", "ae_error", "if_score", "lof", "confidence", "models"])
    for alert in alerts:
        writer.writerow([
            alert.id,
            alert.timestamp.isoformat(),
            alert.end_timestamp.isoformat() if alert.end_timestamp else "",
            alert.peak_severity,
            alert.frame,
            alert.state,
            alert.ae_error,
            alert.if_score,
            alert.lof,
            alert.confidence,
            "|".join(alert.models or []),
        ])
    return output.getvalue()
