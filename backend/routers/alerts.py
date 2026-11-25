import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from database import Alert, SessionLocal, User
from routers.auth import get_current_user
from utils.live_session import get_session

router = APIRouter()


def _alert_data(alert):
    return {
        "id": alert.id,
        "timestamp": alert.timestamp.isoformat(),
        "end_timestamp": alert.end_timestamp.isoformat() if alert.end_timestamp else None,
        "peak_severity": alert.peak_severity,
        "state": alert.state,
        "ae_error": alert.ae_error,
        "if_score": alert.if_score,
        "lof": alert.lof,
        "confidence": alert.confidence,
        "models": alert.models,
        "frame": alert.frame,
    }


@router.get("/history")
def get_alert_history(user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        alerts = db.scalars(
            select(Alert).where(Alert.user_id == user.id).order_by(Alert.timestamp.desc())
        ).all()
    return {"total": len(alerts), "alerts": [_alert_data(alert) for alert in alerts]}


@router.get("/stats")
def get_alert_stats(user: User = Depends(get_current_user)):
    session = get_session(user.id)
    stats = session.get_stats()
    with SessionLocal() as db:
        user_alerts = db.scalars(select(Alert).where(Alert.user_id == user.id)).all()
    total = len(user_alerts)
    yawn_alerts = sum(bool((alert.live_signals or {}).get("yawn")) for alert in user_alerts)
    rate = (stats["alert_frames"] / stats["total_frames"] * 100) if stats["total_frames"] else 0
    return {
        "total_frames": stats["total_frames"],
        "alert_frames": stats["alert_frames"],
        "drowsy_alerts": total,
        "yawn_alerts": yawn_alerts,
        "session_duration": f"{int(stats['session_seconds'] // 60)} min",
        "alert_rate": f"{rate:.1f}%",
    }


@router.get("/export")
def export_alerts(user: User = Depends(get_current_user)):
    with SessionLocal() as db:
        alerts = db.scalars(
            select(Alert).where(Alert.user_id == user.id).order_by(Alert.timestamp.asc())
        ).all()
        output = io.StringIO()
        columns = ["id", "timestamp", "end_timestamp", "peak_severity", "state", "ae_error", "if_score", "lof", "confidence", "models", "frame"]
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        for alert in alerts:
            writer.writerow(_alert_data(alert))
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=alerts.csv"})
