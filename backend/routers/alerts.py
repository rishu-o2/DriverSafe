from fastapi import APIRouter
from typing import Dict, Any, List
import datetime

router = APIRouter()

MOCK_ALERTS = [
    {"id": 1, "timestamp": (datetime.datetime.now() - datetime.timedelta(minutes=50)).isoformat(), "state": "Yawn", "ae_error": 0.82, "if_score": 0.65, "lof": 1.6, "confidence": 0.88, "models": ["AE", "IF", "LOF"]},
    {"id": 2, "timestamp": (datetime.datetime.now() - datetime.timedelta(minutes=40)).isoformat(), "state": "Drowsy", "ae_error": 0.91, "if_score": 0.72, "lof": 1.8, "confidence": 0.94, "models": ["AE", "IF", "LOF"]},
    {"id": 3, "timestamp": (datetime.datetime.now() - datetime.timedelta(minutes=30)).isoformat(), "state": "Drowsy", "ae_error": 0.78, "if_score": 0.61, "lof": 1.4, "confidence": 0.79, "models": ["AE", "IF"]},
    {"id": 4, "timestamp": (datetime.datetime.now() - datetime.timedelta(minutes=20)).isoformat(), "state": "Yawn", "ae_error": 0.85, "if_score": 0.68, "lof": 1.7, "confidence": 0.89, "models": ["AE", "IF", "LOF"]},
    {"id": 5, "timestamp": (datetime.datetime.now() - datetime.timedelta(minutes=10)).isoformat(), "state": "Drowsy", "ae_error": 0.88, "if_score": 0.55, "lof": 1.9, "confidence": 0.85, "models": ["AE", "LOF"]},
    {"id": 6, "timestamp": datetime.datetime.now().isoformat(), "state": "Drowsy", "ae_error": 0.95, "if_score": 0.75, "lof": 2.1, "confidence": 0.97, "models": ["AE", "IF", "LOF"]},
]

@router.get("/history")
async def get_alerts_history() -> Dict[str, Any]:
    return {
        "total": len(MOCK_ALERTS),
        "alerts": MOCK_ALERTS
    }

@router.get("/stats")
async def get_alerts_stats() -> Dict[str, Any]:
    return {
        "total_frames": 3842,
        "alert_frames": 3795,
        "drowsy_alerts": 31,
        "yawn_alerts": 16,
        "session_duration": "64 min",
        "alert_rate": "1.2%"
    }

@router.get("/export")
async def export_alerts_csv() -> str:
    header = "id,timestamp,state,ae_error,if_score,lof,confidence,models\n"
    rows = []
    for alert in MOCK_ALERTS:
        models_str = "|".join(alert["models"])
        rows.append(f"{alert['id']},{alert['timestamp']},{alert['state']},{alert['ae_error']},{alert['if_score']},{alert['lof']},{alert['confidence']},{models_str}")
    return header + "\n".join(rows)
