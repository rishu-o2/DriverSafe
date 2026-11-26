import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from utils.live_session import get_session

router = APIRouter()


@router.get("/history")
def get_alert_history():
    alerts = get_session().episode_history
    return {"total": len(alerts), "alerts": alerts}


@router.get("/stats")
def get_alert_stats():
    session = get_session()
    stats = session.get_stats()
    alerts = session.episode_history
    yawn_alerts = sum(bool((alert.get("live_signals") or {}).get("yawn")) for alert in alerts)
    rate = (stats["alert_frames"] / stats["total_frames"] * 100) if stats["total_frames"] else 0
    return {
        "total_frames": stats["total_frames"],
        "alert_frames": stats["alert_frames"],
        "drowsy_alerts": len(alerts),
        "yawn_alerts": yawn_alerts,
        "session_duration": f"{int(stats['session_seconds'] // 60)} min",
        "alert_rate": f"{rate:.1f}%",
    }


@router.get("/export")
def export_alerts():
    output = io.StringIO()
    columns = ["id", "timestamp", "end_timestamp", "peak_severity", "state", "ae_error", "if_score", "lof", "confidence", "models", "frame"]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(get_session().episode_history)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=alerts.csv"})
