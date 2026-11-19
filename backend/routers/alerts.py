"""Non-persistent alert history contract for the public demo."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/history")
def get_alert_history():
    return {"total": 0, "alerts": [], "notice": "Alert history is not saved in the public demo."}


@router.get("/stats")
def get_alert_stats():
    return {"total_frames": 0, "alert_frames": 0, "drowsy_alerts": 0, "yawn_alerts": 0, "session_duration": "0 min", "alert_rate": "0.0%"}
