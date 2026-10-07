from fastapi import APIRouter
from typing import Any, Dict
import os
import sys
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.alert_logger import AlertLogger
from utils.live_session import get_stats

router = APIRouter()
_logger = AlertLogger(os.path.join(os.path.dirname(__file__), "..", "data", "alerts", "alerts.json"))


@router.get("/history")
async def get_alerts_history() -> Dict[str, Any]:
    alerts = _logger.get_history()
    return {"total": len(alerts), "alerts": list(reversed(alerts))}


@router.get("/stats")
async def get_alerts_stats() -> Dict[str, Any]:
    alerts = _logger.get_history()
    session = get_stats()
    frames = session["total_frames"]
    started_at = datetime.fromisoformat(session["session_started_at"])
    session_alerts = [alert for alert in alerts if datetime.fromisoformat(alert["timestamp"]) >= started_at]
    duration_minutes = session["session_seconds"] / 60
    return {
        "total_frames": frames,
        "alert_frames": session["alert_frames"],
        "drowsy_alerts": sum(1 for alert in session_alerts if alert.get("state", "").lower() == "drowsy"),
        "yawn_alerts": sum(1 for alert in session_alerts if alert.get("state", "").lower() == "yawn"),
        "session_duration": f"{duration_minutes:.1f} min",
        "alert_rate": f"{(session['alert_frames'] / max(frames, 1) * 100):.1f}%",
    }


@router.get("/export")
async def export_alerts_csv() -> str:
    return _logger.export_csv()