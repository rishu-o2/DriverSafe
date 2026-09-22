import json
import os
import datetime
from typing import List, Dict, Any

class AlertLogger:
    def __init__(self, filepath: str = "data/alerts/alerts.json"):
        self.filepath = filepath
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
        if not os.path.exists(self.filepath):
            with open(self.filepath, 'w') as f:
                json.dump([], f)
                
    def _read_alerts(self) -> List[Dict[str, Any]]:
        try:
            with open(self.filepath, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
            
    def _write_alerts(self, alerts: List[Dict[str, Any]]):
        with open(self.filepath, 'w') as f:
            json.dump(alerts, f, indent=4)
            
    def log_alert(self, frame: int, state: str, scores: Dict[str, float]):
        alerts = self._read_alerts()
        new_alert = {
            "id": len(alerts) + 1,
            "timestamp": datetime.datetime.now().isoformat(),
            "frame": frame,
            "state": state,
            "ae_error": scores.get("ae_error", 0.0),
            "if_score": scores.get("if_score", 0.0),
            "lof": scores.get("lof", 0.0),
            "confidence": scores.get("confidence", 1.0),
            "models": scores.get("models", [])
        }
        alerts.append(new_alert)
        self._write_alerts(alerts)
        
    def get_history(self) -> List[Dict[str, Any]]:
        return self._read_alerts()
        
    def get_stats(self) -> Dict[str, Any]:
        alerts = self._read_alerts()
        drowsy_count = sum(1 for a in alerts if a["state"].lower() == "drowsy")
        yawn_count = sum(1 for a in alerts if a["state"].lower() == "yawn")
        
        return {
            "total_alerts": len(alerts),
            "drowsy_alerts": drowsy_count,
            "yawn_alerts": yawn_count
        }
        
    def clear(self):
        self._write_alerts([])
        
    def export_csv(self) -> str:
        alerts = self._read_alerts()
        if not alerts:
            return "id,timestamp,frame,state,ae_error,if_score,lof,confidence,models\n"
            
        header = "id,timestamp,frame,state,ae_error,if_score,lof,confidence,models\n"
        rows = []
        for alert in alerts:
            models_str = "|".join(alert.get("models", []))
            row = f"{alert['id']},{alert['timestamp']},{alert.get('frame', 0)},{alert['state']},{alert.get('ae_error', 0)},{alert.get('if_score', 0)},{alert.get('lof', 0)},{alert.get('confidence', 0)},{models_str}"
            rows.append(row)
        return header + "\n".join(rows)
